use bincode::{deserialize_from, serialize_into};
use dirs::config_dir;
use opencv::core::{Mat, Vector};
use opencv::imgcodecs::imwrite;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{from_reader, to_writer_pretty};
use std::error::Error;
use std::fs::{create_dir_all, File};
use std::io::{BufReader, BufWriter, Error as IOError, ErrorKind};
use std::path::PathBuf;

#[macro_export]
macro_rules! collection {
  ($($k:expr => $v:expr),* $(,)?) => {{
      use std::iter::{Iterator, IntoIterator};
      Iterator::collect(IntoIterator::into_iter([$(($k, $v),)*]))
  }};
  ($($v:expr),* $(,)?) => {{
      use std::iter::{Iterator, IntoIterator};
      Iterator::collect(IntoIterator::into_iter([$($v,)*]))
  }};
}

#[macro_export]
macro_rules! timed {
    ($context:literal, $expr:expr) => {{
        let timer = std::time::Instant::now();
        let value = $expr;
        println!("{}: {:?}", $context, timer.elapsed());
        value
    }};
}

#[macro_export]
macro_rules! memoized {
    ($input:expr, $cache:expr, $body:expr) => {{
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        $input.hash(&mut hasher);
        let hash = hasher.finish();

        *$cache.lock().unwrap().entry(hash).or_insert_with(|| $body)
    }};
}

pub trait DiscSynchronized: Sized + Serialize + DeserializeOwned {
    fn create_new() -> Self;

    fn file_name() -> &'static str;

    fn save_impl(&self, writer: &mut BufWriter<File>) -> Result<(), Box<dyn Error>>;

    fn load_impl(reader: BufReader<File>) -> Result<Self, Box<dyn Error>>;

    fn output_path() -> Result<PathBuf, Box<dyn Error>> {
        let mut path = config_dir()
            .ok_or_else(|| IOError::new(ErrorKind::Other, "Cannot find home directory."))?;
        path.push(PathBuf::from(Self::file_name()));
        Ok(path)
    }

    fn save(&self) -> Result<(), Box<dyn Error>> {
        let output_path = Self::output_path()?;
        if let Some(parent) = output_path.parent() {
            create_dir_all(parent)?;
        }

        let mut writer = BufWriter::new(File::create(output_path)?);
        self.save_impl(&mut writer)
    }

    fn new_saved() -> Result<Self, Box<dyn Error>> {
        let value = Self::create_new();
        value.save()?;
        Ok(value)
    }

    fn load() -> Result<Self, Box<dyn Error>> {
        File::open(Self::output_path()?)
            .map_err(Into::into)
            .and_then(|file| Self::load_impl(BufReader::new(file)))
    }

    fn load_or_new_saved() -> Result<Self, Box<dyn Error>> {
        Self::load().or_else(|_| Self::new_saved())
    }
}

pub trait BincodeDiscSynchronized: DiscSynchronized {
    fn save_impl(&self, writer: &mut BufWriter<File>) -> Result<(), Box<dyn Error>> {
        serialize_into(writer, self).map_err(Into::into)
    }

    fn load_impl(reader: BufReader<File>) -> Result<Self, Box<dyn Error>> {
        deserialize_from(reader).map_err(Into::into)
    }
}

pub trait JsonDiscSynchronized: DiscSynchronized {
    fn save_impl(&self, writer: &mut BufWriter<File>) -> Result<(), Box<dyn Error>> {
        to_writer_pretty(writer, self).map_err(Into::into)
    }

    fn load_impl(reader: BufReader<File>) -> Result<Self, Box<dyn Error>> {
        from_reader(reader).map_err(Into::into)
    }
}

pub fn save_image(name: &str, image: &Mat) {
    imwrite(
        &format!("d:/Workspace/rust/archbroski/images/temp/{}", name),
        &image,
        &Vector::default(),
    )
    .unwrap();
}
