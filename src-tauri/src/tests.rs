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
            show_tiers: false,
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
    assert!(combo.iter().collect::<HashSet<_>>().contains(&5));
    assert!(combo.iter().collect::<HashSet<_>>().contains(&20));
}

#[test]
fn does_not_mess_up_recipe() {
    let combo = get_suggested_combo(
        collection![vec![38, 60, 57, 46], vec![37, 38, 31, 4]],
        collection![54, 55, 56, 59, 61, 62],
        collection![19 => 1, 34 => 1, 20 => 1, 9 => 1, 7 => 1],
        collection![],
    );
    assert!(combo.is_some());
    let combo = combo.unwrap();
    assert_eq!(combo, vec![19, 34, 20, 9]);

    let combo = get_suggested_combo(
        collection![vec![38, 60, 57, 46], vec![37, 38, 31, 4]],
        collection![54, 55, 56, 59, 61, 62],
        collection![19 => 1, 34 => 1, 20 => 1, 9 => 1, 7 => 1],
        collection![19, 34, 20],
    );
    assert!(combo.is_some());
    let combo = combo.unwrap();
    assert_eq!(combo, vec![19, 34, 20, 9]);
}

#[test]
fn stash_full_four_filler() {
    let combo = get_suggested_combo(
        collection![],
        collection![],
        collection![0 => 15, 1 => 15, 2 => 15, 3 => 14],
        collection![],
    );
    assert!(combo.is_none());

    let combo = get_suggested_combo(
        collection![],
        collection![],
        collection![0 => 15, 1 => 15, 2 => 15, 3 => 15],
        collection![],
    );
    assert!(combo.is_some());
}
