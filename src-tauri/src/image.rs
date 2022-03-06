use crate::logic::{ModifierId, MODIFIERS};
use crate::{collection, info_timed, Cache};
use dashmap::DashMap;
use itertools::Itertools;
use log::{info, warn};
use once_cell::sync::Lazy;
use opencv::core::{min_max_loc, Point, Scalar, CV_32F, CV_8U};
use opencv::imgcodecs::IMREAD_COLOR;
use opencv::imgproc::{cvt_color, COLOR_BGR2GRAY, COLOR_BGRA2BGR};
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
use std::hash::{Hash, Hasher};
use std::{collections::HashMap, ops::Deref};

macro_rules! import_images {
    ($($s:expr),*) => {
      collection![$(
        $s => include_bytes!(concat!("resources/reference_images/", $s, ".png")).to_vec(),
      )*]
    };
}

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

/// https://github.com/twistedfall/opencv-rust/issues/324
struct MatSync(Mat);

unsafe impl Sync for MatSync {}

impl Deref for MatSync {
    type Target = Mat;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Debug)]
struct Cell {
    tag: u8,
    area: Rectangle,
}

struct CellGroup {
    template: MatSync,
    grayscale: bool,
    area: Rectangle,
    cell_areas: HashSet<Rectangle>,
}

#[derive(Clone, Debug)]
pub struct Screenshot {
    pub buffer: Vec<u8>,
    pub width: usize,
    pub height: usize,
}

impl Screenshot {
    fn into_mat(self) -> Mat {
        let temp_mat = Mat::from_slice(&self.buffer).unwrap();
        let temp_mat = temp_mat.reshape(4, self.height as i32).unwrap();
        let mut mat = Mat::default();
        cvt_color(&temp_mat, &mut mat, COLOR_BGRA2BGR, 0).unwrap();
        mat
    }
}

pub struct ProcessImageResult {
    pub stash_area: Rectangle,
    pub stash_modifier_ids: HashMap<Rectangle, Option<ModifierId>>,
    pub queue_modifier_ids: Vec<Option<ModifierId>>,
}

static CELL_GROUPS: Lazy<DashMap<u8, CellGroup>> = Lazy::new(|| {
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
        CellGroup {
            template: MatSync(template),
            grayscale: false,
            area: Rectangle::new(
                offset.0,
                offset.1,
                template_size.height as u32,
                template_size.height as u32,
            ),
            cell_areas,
        }
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
        CellGroup {
            template: MatSync(template),
            grayscale: true,
            area: Rectangle::new(0, 0, 0, 0),
            cell_areas,
        }
    };
    collection![
        0 => stash,
        1 => queue,
    ]
});

static MODIFIER_TEMPLATES: Lazy<DashMap<&str, (MatSync, MatSync)>> = Lazy::new(|| {
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
    modifier_templates
        .into_iter()
        .map(|(modifier_name, modifier_template)| {
            let modifier_template =
                imdecode(&Vector::from_slice(&modifier_template), IMREAD_COLOR).unwrap();
            let modifier_template_grayscale = to_grayscale(&modifier_template);
            (
                modifier_name,
                (
                    MatSync(modifier_template),
                    MatSync(modifier_template_grayscale),
                ),
            )
        })
        .collect()
});

fn to_grayscale(image: &Mat) -> Mat {
    let mut image_grayscale = Mat::default();
    cvt_color(&image, &mut image_grayscale, COLOR_BGR2GRAY, 0).unwrap();
    image_grayscale
}

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

fn get_layout(cache: &mut Cache, screenshot: &MatSync) -> Option<HashMap<u8, Vec2>> {
    let layout_matches = |layout: &&HashMap<u8, Vec2>| {
        CELL_GROUPS.par_iter_mut().all(|entry| {
            let tag = *entry.key();
            let cell_group = &*entry;
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
    };
    if cache.layout.as_ref().filter(layout_matches).is_none() {
        if let Some(layout) = {
            let layout: HashMap<_, _> = CELL_GROUPS
                .par_iter_mut()
                .filter_map(|entry| {
                    let tag = *entry.key();
                    let cell_group = &*entry;
                    let (offset, score) = match_template(screenshot, &cell_group.template);
                    if score.is_normal() && score > 0.95 {
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
        } {
            info!("using new valid layout");
            cache.modified = true;
            cache.layout = Some(layout);
            cache.layout.clone()
        } else {
            warn!("invalid layout");
            None
        }
    } else {
        info!("using previous valid layout");
        cache.layout.clone()
    }
}

fn get_cells(layout: &HashMap<u8, Vec2>) -> Vec<Cell> {
    CELL_GROUPS
        .iter()
        .flat_map(|entry| {
            let tag = *entry.key();
            let cell_group = &*entry;
            let cell_group_offset = layout[&tag];
            cell_group
                .cell_areas
                .iter()
                .map(|&cell_area| Cell {
                    tag,
                    area: cell_area.translate(cell_group_offset),
                })
                .collect_vec()
        })
        .collect_vec()
}

fn get_modifier_id(
    cache_images: &DashMap<u64, Option<ModifierId>>,
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
    let modifier_id = *cache_images
        .entry(hash_image(&crop_image(&cell_image, 10)))
        .or_insert_with(|| {
            let (modifier_id, score) = MODIFIERS
                .by_id
                .values()
                .map(|modifier| {
                    let (template, template_grayscale) =
                        &*MODIFIER_TEMPLATES.get(modifier.name.as_str()).unwrap();
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
            if score.is_normal() && score > 0.8 {
                Some(modifier_id)
            } else {
                None
            }
        })
        .value();
    modifier_id
}

pub fn process_image(cache: &mut Cache, screenshot: Screenshot) -> Option<ProcessImageResult> {
    let screenshot = MatSync(screenshot.into_mat());
    info_timed!("get_layout", get_layout(cache, &screenshot)).map(|layout| {
        let cells = get_cells(&layout);
        let cache_images = &cache.images;
        let cache_images_count = cache_images.len();
        let modifier_ids = info_timed!(
            "match_cells",
            cells
                .into_par_iter()
                .map(|cell| {
                    let grayscale = CELL_GROUPS.get(&cell.tag).unwrap().grayscale;
                    (
                        cell.tag,
                        cell.area,
                        get_modifier_id(cache_images, &screenshot, &cell, grayscale),
                    )
                })
                .collect::<Vec<_>>()
        );
        if cache_images.len() > cache_images_count {
            cache.modified = true;
        }

        let modifier_ids_by_tags = modifier_ids.iter().into_group_map_by(|&&(tag, _, _)| tag);
        ProcessImageResult {
            stash_area: CELL_GROUPS.get(&0).unwrap().area.translate(layout[&0]),
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
        }
    })
}
