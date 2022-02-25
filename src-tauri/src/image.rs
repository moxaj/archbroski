use crate::collection;
use crate::logic::{ModifierId, MODIFIERS};
use crate::utils::save_image;
use bincode::{deserialize_from, serialize_into};
use dashmap::DashMap;
use dirs::config_dir;
use itertools::Itertools;
use once_cell::sync::Lazy;
use opencv::core::{min_max_loc, Point, Scalar, CV_32F, CV_8U};
use opencv::imgcodecs::IMREAD_COLOR;
use opencv::imgproc::{cvt_color, COLOR_BGR2GRAY};
use opencv::prelude::*;
use opencv::{
    core::{Mat, MatExprTraitConst, MatTraitConstManual, Range, Size, Vector},
    imgcodecs::imdecode,
    imgproc::{match_template as opencv_match_template, TM_CCOEFF_NORMED},
};
use rayon::iter::{IntoParallelIterator, ParallelIterator};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::cmp::Ordering::Equal;
use std::collections::hash_map::DefaultHasher;
use std::collections::HashSet;
use std::fs::File;
use std::hash::{Hash, Hasher};
use std::io::{BufReader, BufWriter, Error as IOError, ErrorKind};
use std::path::PathBuf;
use std::sync::Mutex;
use std::{collections::HashMap, error::Error, ops::Deref};

macro_rules! import_images {
    ($($s:expr),*) => {
      collection![$(
        $s => include_bytes!(concat!("resources/reference_images/", $s, ".png")).to_vec(),
      )*]
    };
}

/// A 2-dimensional vector.
#[derive(Clone, Copy, Default, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Vec2 {
    pub x: u32,
    pub y: u32,
}

impl Vec2 {
    pub fn new(x: u32, y: u32) -> Self {
        Self { x, y }
    }
}

/// A rectangle.
#[derive(
    Clone, Copy, Default, PartialEq, Eq, Hash, PartialOrd, Ord, Debug, Serialize, Deserialize,
)]
pub struct Rectangle {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

impl Rectangle {
    pub fn new(x: u32, y: u32, width: u32, height: u32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }

    pub fn translate(&self, offset: Vec2) -> Rectangle {
        Rectangle::new(
            self.x + offset.x,
            self.y + offset.y,
            self.width,
            self.height,
        )
    }
}

/// A cell.
#[derive(Debug)]
struct Cell {
    tag: u8,
    area: Rectangle,
}

/// A group of cells.
struct CellGroup {
    template: Mat,
    grayscale: bool,
    area: Rectangle,
    cell_areas: HashSet<Rectangle>,
}

/// A Mat wrapper which is Sync.
struct MatSync(Mat);

unsafe impl Sync for MatSync {}

impl Deref for MatSync {
    type Target = Mat;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// The result of the image recognition algorithm.
pub struct ProcessImageResult {
    pub stash_area: Rectangle,
    pub stash_modifier_ids: HashMap<Rectangle, Option<ModifierId>>,
    pub queue_modifier_ids: Vec<Option<ModifierId>>,
    pub cache_modified: bool,
}

/// The cell group templates (for the stash and the queue).
static CELL_GROUPS: Lazy<HashMap<u8, Mutex<CellGroup>>> = Lazy::new(|| {
    let stash = {
        let template = imdecode(
            &Vector::from_slice(include_bytes!("resources/stash_template.png")),
            IMREAD_COLOR,
        )
        .unwrap();

        let template_size = template.size().unwrap();
        let offset = (template_size.width as u32, 0u32);
        let cell_size_f32 = template_size.height as f32 / 8.0;
        let cell_areas = (0..64u32)
            .map(|index| {
                Rectangle::new(
                    (offset.0 as f32 + cell_size_f32 * (index % 8) as f32).floor() as u32,
                    (offset.1 as f32 + cell_size_f32 * (index / 8) as f32).floor() as u32,
                    cell_size_f32.floor() as u32,
                    cell_size_f32.floor() as u32,
                )
            })
            .collect();
        Mutex::new(CellGroup {
            template,
            grayscale: false,
            area: Rectangle::new(
                offset.0,
                offset.1,
                template_size.height as u32,
                template_size.height as u32,
            ),
            cell_areas,
        })
    };
    let queue = {
        let template = imdecode(
            &Vector::from_slice(include_bytes!("resources/queue_template.png")),
            IMREAD_COLOR,
        )
        .unwrap();

        let cell_areas = collection![
            Rectangle::new(42, 44, 52, 52),
            Rectangle::new(124, 44, 52, 52),
            Rectangle::new(206, 44, 52, 52),
            Rectangle::new(289, 44, 52, 52),
        ];
        Mutex::new(CellGroup {
            template,
            grayscale: true,
            area: Rectangle::new(0, 0, 0, 0),
            cell_areas,
        })
    };
    collection![
        0 => stash,
        1 => queue,
    ]
});

/// The modifier templates.
static MODIFIER_TEMPLATES: Lazy<Mutex<HashMap<&str, (Mat, Mat)>>> = Lazy::new(|| {
    let modifier_templates: HashMap<_, _> = import_images!(
        "Abberath-Touched",
        "Arakaali-Touched",
        "Arcane Buffer",
        "Assassin",
        "Berserker",
        "Bloodletter",
        "Bombardier",
        "Bonebreaker",
        "Brine King-Touched",
        "Chaosweaver",
        "Consecrator",
        "Corpse Detonator",
        "Corrupter",
        "Crystal-Skinned",
        "Deadeye",
        "Drought Bringer",
        "Dynamo",
        "Echoist",
        "Effigy",
        "Empowered Elements",
        "Empowering Minions",
        "Entangler",
        "Evocationist",
        "Executioner",
        "Flame Strider",
        "Flameweaver",
        "Frenzied",
        "Frost Strider",
        "Frostweaver",
        "Gargantuan",
        "Hasted",
        "Heralding Minions",
        "Hexer",
        "Ice Prison",
        "Incendiary",
        "Innocence-Touched",
        "Invulnerable",
        "Juggernaut",
        "Kitava-Touched",
        "Lunaris-Touched",
        "Magma Barrier",
        "Malediction",
        "Mana Siphoner",
        "Mirror Image",
        "Necromancer",
        "Opulent",
        "Overcharged",
        "Permafrost",
        "Rejuvenating",
        "Sentinel",
        "Shakari-Touched",
        "Solaris-Touched",
        "Soul Conduit",
        "Soul Eater",
        "Steel-Infused",
        "Storm Strider",
        "Stormweaver",
        "Temporal Bubble",
        "Toxic",
        "Treant Horde",
        "Trickster",
        "Tukohama-Touched",
        "Vampiric"
    );
    Mutex::new(
        modifier_templates
            .into_iter()
            .map(|(modifier_name, modifier_template)| {
                let modifier_template =
                    imdecode(&Vector::from_slice(&modifier_template), IMREAD_COLOR).unwrap();
                let modifier_template_grayscale = to_grayscale(&modifier_template);
                (
                    modifier_name,
                    (modifier_template, modifier_template_grayscale),
                )
            })
            .collect(),
    )
});

/// A serializable cache.
#[derive(Serialize, Deserialize)]
struct SerializableCache {
    images: HashMap<u64, Option<ModifierId>>,
    layout: Option<HashMap<u8, Vec2>>,
}

impl SerializableCache {
    fn new(images: HashMap<u64, Option<ModifierId>>, layout: Option<HashMap<u8, Vec2>>) -> Self {
        Self { images, layout }
    }

    fn output_path() -> Result<PathBuf, Box<dyn Error>> {
        let mut path = config_dir()
            .ok_or_else(|| IOError::new(ErrorKind::Other, "Cannot find home directory."))?;
        path.push(PathBuf::from(r"archbro\.cache"));
        Ok(path)
    }

    fn save(&self) -> Result<(), Box<dyn Error>> {
        let mut file = BufWriter::new(File::create(Self::output_path()?)?);
        serialize_into(&mut file, self).map_err(Into::into)
    }

    fn new_saved() -> Result<Self, Box<dyn Error>> {
        let cache = Self::new(HashMap::new(), None);
        cache.save()?;
        Ok(cache)
    }

    fn load() -> Result<Self, Box<dyn Error>> {
        File::open(Self::output_path()?)
            .map_err(Into::into)
            .and_then(|file| deserialize_from(BufReader::new(file)).map_err(Into::into))
    }

    fn load_or_new_saved() -> Result<Self, Box<dyn Error>> {
        Self::load().or_else(|error| Self::new_saved())
    }
}

#[derive(PartialEq, Eq)]
pub struct CacheSnapshot {
    image_count: usize,
    layout: Option<HashMap<u8, Vec2>>,
}

/// A cache to store recognized layouts and modifiers.
pub struct Cache {
    pub images: DashMap<u64, Option<ModifierId>>,
    pub layout: Option<HashMap<u8, Vec2>>,
}

impl Cache {
    fn from_serialized(serializable_cache: SerializableCache) -> Self {
        Self {
            images: serializable_cache.images.into_iter().collect(),
            layout: serializable_cache.layout,
        }
    }

    fn to_serialized(&self) -> SerializableCache {
        SerializableCache {
            images: self
                .images
                .iter()
                .map(|entry| (*entry.key(), *entry.value()))
                .collect(),
            layout: self.layout.clone(),
        }
    }

    pub fn to_snapshot(&self) -> CacheSnapshot {
        CacheSnapshot {
            image_count: self.images.len(),
            layout: self.layout.clone(),
        }
    }

    pub fn load() -> Result<Self, Box<dyn Error>> {
        SerializableCache::load_or_new_saved().map(Self::from_serialized)
    }

    pub fn save(&self) -> Result<(), Box<dyn Error>> {
        self.to_serialized().save()
    }
}

/// Converts the given image to grayscale.
fn to_grayscale(image: &Mat) -> Mat {
    let mut image_grayscale = Mat::default();
    cvt_color(&image, &mut image_grayscale, COLOR_BGR2GRAY, 0).unwrap();
    image_grayscale
}

/// Returns a cropped image.
fn crop_image(image: &Mat, padding: u32) -> Mat {
    let image_size = image.size().unwrap();
    let image = image.clone();
    let crop = |image: &Mat, x_range: &Range, y_range: &Range| {
        Mat::rowscols(image, y_range, x_range)
            .unwrap()
            .set(Scalar::new(0.0, 0.0, 0.0, 0.0))
            .unwrap();
    };
    crop(
        &image,
        &Range::new(0, padding as i32).unwrap(),
        &Range::new(0, image_size.height).unwrap(),
    );
    crop(
        &image,
        &Range::new(image_size.width - padding as i32, image_size.width).unwrap(),
        &Range::new(0, image_size.height).unwrap(),
    );
    crop(
        &image,
        &Range::new(0, image_size.width).unwrap(),
        &Range::new(0, padding as i32).unwrap(),
    );
    crop(
        &image,
        &Range::new(0, image_size.width).unwrap(),
        &Range::new(image_size.height - padding as i32, image_size.height).unwrap(),
    );
    image
}

/// Calculates the hash of an image.
fn hash_image(image: &Mat) -> u64 {
    let image = if image.is_continuous() {
        Cow::Borrowed(image)
    } else {
        Cow::Owned(image.try_clone().unwrap())
    };

    let mut hasher = DefaultHasher::new();
    image.data_bytes().unwrap().hash(&mut hasher);
    hasher.finish()
}

/// Runs a template matching for the given image and template.
fn match_template(source: &Mat, template: &Mat) -> (Vec2, f32) {
    let source_size = source.size().unwrap();
    let source_width = source_size.width;
    let source_height = source_size.height;

    let template_size = template.size().unwrap();
    let template_width = template_size.width;
    let template_height = template_size.height;

    let result_width = source_width - template_width + 1;
    let result_height = source_height - template_height + 1;
    let result_size = Size::new(result_width, result_height);
    let mut results = Mat::zeros_size(result_size, CV_32F)
        .unwrap()
        .to_mat()
        .unwrap();
    opencv_match_template(
        source,
        template,
        &mut results,
        TM_CCOEFF_NORMED,
        &Mat::ones_size(template.size().unwrap(), CV_8U).unwrap(),
    )
    .unwrap();

    let max_val = &mut 0f64;
    let max_loc = &mut Point::new(0, 0);
    min_max_loc(
        &results,
        None,
        Some(max_val),
        None,
        Some(max_loc),
        &Mat::default(),
    )
    .unwrap();
    (
        Vec2::new(max_loc.x as u32, max_loc.y as u32),
        *max_val as f32,
    )
}

/// Returns the detected layout for the given screenshot.
fn get_layout(cache: &mut Cache, screenshot: &Mat) -> Option<HashMap<u8, Vec2>> {
    cache.layout = cache
        .layout
        .take()
        .filter(|layout| {
            CELL_GROUPS.iter().all(|(&tag, cell_group)| {
                let cell_group = cell_group.lock().unwrap();
                let cell_group_offset = layout[&tag];
                let cell_group_template_size = cell_group.template.size().unwrap();
                let source = Mat::rowscols(
                    screenshot,
                    &Range::new(
                        cell_group_offset.y as i32,
                        cell_group_offset.y as i32 + cell_group_template_size.height,
                    )
                    .unwrap(),
                    &Range::new(
                        cell_group_offset.x as i32,
                        cell_group_offset.x as i32 + cell_group_template_size.width,
                    )
                    .unwrap(),
                )
                .unwrap();
                match_template(&source, &cell_group.template).1 > 0.95
            })
        })
        .or_else(|| {
            let layout: HashMap<_, _> = CELL_GROUPS
                .iter()
                .filter_map(|(&tag, cell_group)| {
                    let cell_group = cell_group.lock().unwrap();
                    let (offset, score) = match_template(screenshot, &cell_group.template);
                    if score > 0.95 {
                        Some((tag, offset))
                    } else {
                        None
                    }
                })
                .collect();
            if layout.len() < CELL_GROUPS.len() {
                None
            } else {
                Some(layout)
            }
        });
    cache.layout.clone() // Wish I could return a reference..
}

/// Returns the cells of the given screenshot.
fn get_cells(layout: &HashMap<u8, Vec2>) -> Vec<Cell> {
    CELL_GROUPS
        .iter()
        .flat_map(|(&tag, cell_group)| {
            let cell_group = cell_group.lock().unwrap();
            let cell_group_offset = layout[&tag];
            cell_group
                .cell_areas
                .iter()
                .map(|&cell_area| Cell {
                    tag,
                    area: cell_area.translate(cell_group_offset),
                })
                .collect::<Vec<_>>()
        })
        .collect_vec()
}

/// Returns the modifier id for the given cell.
fn get_modifier_id(
    cache: &Mutex<&mut Cache>,
    screenshot: &Mat,
    cell: &Cell,
    grayscale: bool,
) -> Option<ModifierId> {
    let cell_image = Mat::rowscols(
        screenshot,
        &Range::new(cell.area.y as i32, (cell.area.y + cell.area.height) as i32).unwrap(),
        &Range::new(cell.area.x as i32, (cell.area.x + cell.area.width) as i32).unwrap(),
    )
    .unwrap();
    let cell_image_grayscale = to_grayscale(&cell_image);
    let modifier_id = *cache
        .lock()
        .unwrap()
        .images
        .entry(hash_image(&crop_image(&cell_image, 10)))
        .or_insert_with(|| {
            let (modifier_id, score) = MODIFIERS
                .by_id
                .values()
                .map(|modifier| {
                    let (template, template_grayscale) =
                        &MODIFIER_TEMPLATES.lock().unwrap()[&modifier.name];
                    (
                        modifier.id,
                        match_template(
                            if grayscale {
                                &cell_image_grayscale
                            } else {
                                &cell_image
                            },
                            if grayscale {
                                template_grayscale
                            } else {
                                template
                            },
                        )
                        .1,
                    )
                })
                .max_by(|&(_, score1), &(_, score2)| score1.partial_cmp(&score2).unwrap_or(Equal))
                .unwrap();
            if score > 0.8 {
                Some(modifier_id)
            } else {
                None
            }
        })
        .value();
    modifier_id
}

/// Processes the given screenshot.
pub fn process_image(cache: &mut Cache, screenshot: Mat) -> Option<ProcessImageResult> {
    let screenshot_sync = MatSync(screenshot.clone());
    let cache_snapshot = cache.to_snapshot();
    get_layout(cache, &screenshot).map(|layout| {
        let cache_mutex = Mutex::new(cache);
        let cells = get_cells(&layout);
        let modifier_ids = cells
            .into_par_iter()
            .map(|cell| {
                let grayscale = CELL_GROUPS[&cell.tag].lock().unwrap().grayscale;
                (
                    cell.tag,
                    cell.area,
                    get_modifier_id(&cache_mutex, &screenshot_sync, &cell, grayscale),
                )
            })
            .collect::<Vec<_>>();
        let cache = cache_mutex.into_inner().unwrap();
        let modifier_ids_by_tags = modifier_ids.iter().into_group_map_by(|&&(tag, _, _)| tag);
        ProcessImageResult {
            stash_area: CELL_GROUPS[&0].lock().unwrap().area.translate(layout[&0]),
            stash_modifier_ids: modifier_ids_by_tags
                .get(&0u8)
                .unwrap_or(&Vec::new())
                .iter()
                .map(|&&(_, area, modifier_id)| (area, modifier_id))
                .collect(),
            queue_modifier_ids: modifier_ids_by_tags
                .get(&1u8)
                .unwrap_or(&Vec::new())
                .iter()
                .map(|&&(_, area, modifier_id)| (area.x, modifier_id))
                .sorted_by_key(|&(x, _)| x)
                .map(|(_, modifier_id)| modifier_id)
                .collect(),
            cache_modified: cache.to_snapshot() != cache_snapshot,
        }
    })
}
