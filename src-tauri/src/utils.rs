use std::error::Error;

use opencv::core::{Mat, Vector};
use opencv::imgcodecs::imwrite;

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

pub fn save_image(name: &str, image: &Mat) {
    imwrite(
        &format!("d:/Workspace/rust/archbroski/images/temp/{}", name),
        &image,
        &Vector::default(),
    )
    .unwrap();
}
