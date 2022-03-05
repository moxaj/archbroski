use itertools::Itertools;
use std::collections::{BTreeMap, BTreeSet, HashSet};

use crate::{
    collection,
    logic::{suggest_combo, LabeledCombo, ModifierId, UserSettings},
};

fn get_suggested_combo(
    combos: Vec<Vec<ModifierId>>,
    forbidden_modifier_ids: BTreeSet<ModifierId>,
    stash: BTreeMap<ModifierId, usize>,
    queue: Vec<ModifierId>,
) -> Option<Vec<ModifierId>> {
    suggest_combo(
        &UserSettings {
            combo_catalog: combos
                .iter()
                .enumerate()
                .map(|(index, combo)| LabeledCombo {
                    id: index as u64,
                    label: format!("Combo #{}", index),
                    combo: combo.clone(),
                })
                .collect_vec(),
            combo_roster: (0..combos.len() as u64).collect_vec(),
            forbidden_modifier_ids,
            hotkey: "".into(),
        },
        &stash,
        &queue,
    )
}

#[test]
fn empty_stash() {
    assert_eq!(
        None,
        get_suggested_combo(
            collection![vec![0, 1, 2, 3]],
            collection![],
            collection![],
            collection![]
        )
    );
}

#[test]
fn full_queue() {
    assert_eq!(
        None,
        get_suggested_combo(
            collection![vec![0, 1, 2, 3]],
            collection![],
            collection![0 => 1, 1 => 1, 2 => 1, 3 => 1],
            collection![7, 8, 9, 10]
        )
    );
}

#[test]
fn high_priority_combo() {
    assert_eq!(
        Some(vec![0, 1, 2, 3]),
        get_suggested_combo(
            collection![vec![0, 1, 2, 3], vec![4, 5, 6, 7]],
            collection![],
            collection![0 => 1, 1 => 1, 2 => 1, 3 => 1, 4 => 1, 5 => 1, 6 => 1, 7 => 1],
            collection![]
        )
    );
}

#[test]
fn complete_queue() {
    assert_eq!(
        Some(vec![0, 1, 2, 3]),
        get_suggested_combo(
            collection![vec![0, 1, 2, 3], vec![4, 5, 6, 7]],
            collection![],
            collection![0 => 1, 1 => 1, 2 => 1, 3 => 1, 4 => 1, 5 => 1, 6 => 1, 7 => 1],
            collection![0, 1, 2]
        )
    );
}

#[test]
fn only_fillers() {
    assert_eq!(
        None,
        get_suggested_combo(
            collection![vec![0, 1, 2, 3]],
            collection![],
            collection![4 => 1, 5 => 1, 6 => 1, 7 => 1],
            collection![]
        )
    );
}

#[test]
fn recipe_with_fillers() {
    let combo = get_suggested_combo(
        collection![vec![0, 1, 2, 29]],
        collection![],
        collection![5 => 1, 20 => 1, 51 => 1, 52 => 1],
        collection![],
    );
    assert!(combo.is_some());
    let combo = combo.unwrap();
    assert_eq!(true, combo.iter().collect::<HashSet<_>>().contains(&5));
    assert_eq!(true, combo.iter().collect::<HashSet<_>>().contains(&20));
}
