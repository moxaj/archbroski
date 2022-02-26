use dirs::config_dir;
use itertools::Itertools;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering::Equal;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet, VecDeque};
use std::error::Error;
use std::fs::{create_dir_all, File, OpenOptions};
use std::io::{BufReader, ErrorKind};
use std::io::{Error as IOError, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;
use CalculationMode::*;
use Effect::*;
use RewardType::*;

use crate::{collection, memoized};

/// The length of the queue.
const QUEUE_LENGTH: usize = 4;

/// The id of a modifier.
pub type ModifierId = u8;

/// The type of a reward.
#[derive(PartialEq, Eq, Hash, Clone, Copy, Debug, Serialize, Deserialize)]
pub enum RewardType {
    Generic,
    Armour,
    Weapon,
    Jewelry,
    Gem,
    Map,
    DivinationCard,
    Fragment,
    Essence,
    Harbinger,
    Unique,
    Delve,
    Blight,
    Ritual,
    Currency,
    Legion,
    Breach,
    Labyrinth,
    Scarab,
    Abyss,
    Heist,
    Expedition,
    Delirium,
    Metamorph,
    Treant,
}

/// The effect of a recipe.
#[derive(PartialEq, Eq, Hash, Clone, Copy, Debug, Serialize, Deserialize)]
pub enum Effect {
    Reroll { count: usize },
    AdditionalReward,
    DoubledReward,
    Convert { to: RewardType },
}

/// A modifier.
#[derive(PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Modifier {
    pub id: ModifierId,
    pub name: String,
    pub recipe: BTreeSet<ModifierId>,
    #[serde(skip_serializing)]
    pub rewards: HashMap<RewardType, usize>,
    #[serde(skip_serializing)]
    pub effect: Option<Effect>,
}

/// The list of all modifiers, indexed by id and recipe.
#[derive(PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Modifiers {
    pub by_id: HashMap<ModifierId, Modifier>,
    #[serde(skip_serializing)]
    pub by_recipe: HashMap<BTreeSet<ModifierId>, Modifier>,
    pub components: HashMap<ModifierId, HashMap<ModifierId, usize>>,
}

impl Modifiers {
    pub fn new() -> Self {
        let modifiers =
            serde_json::from_str::<'_, Vec<Modifier>>(include_str!("resources/data.json"))
                .expect("Invalid data.json!");
        let by_id = modifiers
            .iter()
            .map(|modifier| (modifier.id, modifier.clone()))
            .collect::<HashMap<_, _>>();
        let by_recipe = modifiers
            .iter()
            .map(|modifier| (modifier.recipe.clone(), modifier.clone()))
            .collect::<HashMap<_, _>>();
        let components = modifiers
            .iter()
            .map(|modifier| {
                let mut modifier_ids = VecDeque::new();
                let mut modifier_id_queue = vec![modifier.id];
                while let Some(modifier_id) = modifier_id_queue.pop() {
                    modifier_ids.push_back(modifier_id);
                    modifier_id_queue.extend(&by_id[&modifier_id].recipe);
                }

                modifier_ids.pop_front();

                (
                    modifier.id,
                    modifier_ids.into_iter().fold(
                        HashMap::<ModifierId, usize>::new(),
                        |mut modifier_components, modifier_id| {
                            *modifier_components.entry(modifier_id).or_default() += 1;
                            modifier_components
                        },
                    ),
                )
            })
            .collect::<HashMap<_, _>>();
        Self {
            by_id,
            by_recipe,
            components,
        }
    }
}

/// All information related to the modifiers.
pub static MODIFIERS: Lazy<Modifiers> = Lazy::new(Modifiers::new);

/// The calculation mode.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CalculationMode {
    Basic,
    Smart,
}

/// A hotkey.
pub type Hotkey = String;

/// All settings for the user.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    pub combos: Vec<Vec<ModifierId>>,
    pub forbidden_modifier_ids: HashSet<ModifierId>,
    pub calculation_mode: CalculationMode,
    pub preferences: HashMap<RewardType, usize>,
    pub time_budget_ms: u64,
    pub hotkey: String,
}

impl UserSettings {
    pub fn load() -> Result<Self, Box<dyn Error>> {
        let mut path = config_dir()
            .ok_or_else(|| IOError::new(ErrorKind::Other, "Cannot find home directory."))?;
        path.push(PathBuf::from(r"archbro\settings.json"));

        File::open(path.clone())
            .map_err(Into::into)
            .and_then(|file| serde_json::from_reader(BufReader::new(file)).map_err(Into::into))
            .or_else(|_: Box<dyn Error>| {
                if let Some(parent) = path.parent() {
                    create_dir_all(parent)?;
                }

                let user_settings = UserSettings {
                    combos: collection![],
                    forbidden_modifier_ids: collection![],
                    calculation_mode: Basic,
                    preferences: collection! {
                        Generic => 1,
                        Armour => 1,
                        Weapon => 1,
                        Jewelry => 1,
                        Gem => 1,
                        Map => 1,
                        DivinationCard => 1,
                        Fragment => 1,
                        Essence => 1,
                        Harbinger => 1,
                        Unique => 1,
                        Delve => 1,
                        Blight => 1,
                        Ritual => 1,
                        Currency => 10,
                        Legion => 1,
                        Breach => 1,
                        Labyrinth => 1,
                        Scarab => 1,
                        Abyss => 1,
                        Heist => 1,
                        Expedition => 1,
                        Delirium => 1,
                        Metamorph => 1,
                        Treant => 1,
                    },
                    time_budget_ms: 1000,
                    hotkey: "ctrl + d".to_owned(),
                };
                writeln!(
                    OpenOptions::new().create(true).write(true).open(path)?,
                    "{}",
                    serde_json::to_string_pretty(&user_settings)?
                )?;
                Ok(user_settings)
            })
    }

    pub fn get_filler_modifier_ids(&self) -> HashSet<ModifierId> {
        let used_modifiers = self
            .combos
            .iter()
            .flat_map(|combo| {
                combo
                    .iter()
                    .flat_map(|modifier_id| MODIFIERS.components[modifier_id].keys())
            })
            .copied()
            .collect::<HashSet<_>>();
        MODIFIERS
            .by_id
            .keys()
            .filter(|&modifier_id| {
                !used_modifiers.contains(modifier_id)
                    && !self.forbidden_modifier_ids.contains(modifier_id)
            })
            .copied()
            .collect()
    }
}

/// A memoization cache for suggest_modifier_id.
static CACHE: Lazy<Mutex<HashMap<u64, Option<ModifierId>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Returns whether the stash contains at least one of the given modifier.
fn has_modifier(stash: &BTreeMap<ModifierId, usize>, modifier_id: ModifierId) -> bool {
    stash.get(&modifier_id).copied().unwrap_or_default() > 0
}

/// Returns the value of the given combo.
fn get_combo_value(user_settings: &UserSettings, combo: &[ModifierId]) -> f32 {
    (0..combo.len()).fold(0f32, |value, index| {
        let modifiers = (0..index + 1)
            .map(|index| &MODIFIERS.by_id[&combo[index]])
            .collect_vec();
        let effects = modifiers
            .iter()
            .flat_map(|&modifier| modifier.effect.iter())
            .collect_vec();
        let additional_reward_count: usize = effects
            .iter()
            .filter(|&&&effect| effect == AdditionalReward)
            .count();
        let doubled_rewards = effects.iter().any(|&&effect| effect == DoubledReward);
        let reroll_count = effects
            .iter()
            .map(|&&effect| {
                if let Reroll { count } = effect {
                    count
                } else {
                    0
                }
            })
            .sum::<usize>();

        let mut rewards = modifiers.iter().map(|&modifier| &modifier.rewards).fold(
            HashMap::new(),
            |mut rewards, rewards_| {
                rewards.extend(rewards_);
                rewards
            },
        );
        if let Some(&converted_reward_type) =
            effects.iter().fold(None, |converted_reward_type, &effect| {
                if let Convert { to } = effect {
                    Some(to)
                } else {
                    converted_reward_type
                }
            })
        {
            rewards = collection! {converted_reward_type => rewards.values().sum()}
        }

        value
            + rewards
                .into_iter()
                .map(|(reward_type, reward_count)| {
                    let base_reward_value = match &user_settings.calculation_mode {
                        Basic => 1,
                        Smart => user_settings.preferences[&reward_type],
                    };
                    base_reward_value as f32
                        * (reward_count + additional_reward_count) as f32
                        * (if doubled_rewards { 2 } else { 1 }) as f32
                        * (1 + reroll_count / 4) as f32
                })
                .sum::<f32>()
    })
}

/// Returns the list of produced modifiers for the given combo.
fn get_produced_modifier_ids(combo: &[ModifierId]) -> HashSet<ModifierId> {
    struct State {
        used_modifiers_ids: HashSet<ModifierId>,
        produced_modifier_ids: HashSet<ModifierId>,
    }

    combo
        .iter()
        .powerset()
        .fold(
            State {
                produced_modifier_ids: HashSet::new(),
                used_modifiers_ids: HashSet::new(),
            },
            |mut state, modifier_ids| {
                if modifier_ids
                    .iter()
                    .all(|&modifier_id| !state.used_modifiers_ids.contains(modifier_id))
                {
                    if let Some(produced_modifier_id) = MODIFIERS
                        .by_recipe
                        .get(&modifier_ids.iter().copied().copied().collect())
                        .map(|modifier| modifier.id)
                    {
                        state.produced_modifier_ids.insert(produced_modifier_id);
                        state.used_modifiers_ids.extend(modifier_ids);
                    }
                }

                state
            },
        )
        .produced_modifier_ids
}

/// Returns the highest valued combo and its value for the given unordered combo (considering the current queue as well).
fn get_unordered_combo_value(
    user_settings: &UserSettings,
    queue: &[ModifierId],
    combo: &BTreeSet<ModifierId>,
    required_modifier_ids: &HashSet<ModifierId>,
) -> Option<(Vec<ModifierId>, f32)> {
    combo
        .difference(&queue.iter().copied().collect::<BTreeSet<_>>())
        .permutations(combo.len() - queue.len())
        .filter_map(|combo_permutation_suffix| {
            let mut combo_permutation = queue.iter().copied().collect_vec();
            combo_permutation.extend(combo_permutation_suffix);

            if get_produced_modifier_ids(&combo_permutation).is_superset(required_modifier_ids) {
                Some((
                    combo_permutation.clone(),
                    get_combo_value(user_settings, &combo_permutation),
                ))
            } else {
                None
            }
        })
        .max_by_key(|&(_, value)| value.floor() as i32)
}

/// Returns the suggested modifier to use.
pub fn suggest_modifier_id(
    user_settings: &UserSettings,
    stash: BTreeMap<ModifierId, usize>,
    queue: Vec<ModifierId>,
) -> Option<ModifierId> {
    memoized!((&stash, &queue), CACHE, {
        let time_before = Instant::now();
        user_settings
            .combos
            .iter()
            .find(|&combo| {
                (0..queue.len()).all(|index| queue[index] == combo[index])
                    && combo
                        .iter()
                        .skip(queue.len())
                        .all(|&modifier_id| has_modifier(&stash, modifier_id))
            })
            .cloned()
            .or_else(|| {
                let mut modifier_ids = user_settings
                    .combos
                    .iter()
                    .flat_map(|combo| {
                        combo
                            .iter()
                            .flat_map(|&modifier_id| {
                                let required_modifier_ids = &MODIFIERS.components[&modifier_id];
                                let mut owned_modifier_ids = HashMap::new();

                                let mut modifier_ids: VecDeque<_> = collection![(modifier_id, 0)];
                                while let Some((modifier_id, parent_count)) =
                                    modifier_ids.pop_front()
                                {
                                    let owned_count =
                                        owned_modifier_ids.entry(modifier_id).or_insert_with(
                                            || stash.get(&modifier_id).copied().unwrap_or_default(),
                                        );
                                    *owned_count += parent_count;

                                    modifier_ids.extend(
                                        MODIFIERS.by_id[&modifier_id]
                                            .recipe
                                            .iter()
                                            .map(|&modifier_id| (modifier_id, *owned_count)),
                                    );
                                }

                                required_modifier_ids
                                    .iter()
                                    .map(|(&modifier_id, &required_count)| {
                                        (
                                            modifier_id,
                                            (owned_modifier_ids
                                                .get(&modifier_id)
                                                .copied()
                                                .unwrap_or_default()
                                                as f32)
                                                / (required_count as f32),
                                        )
                                    })
                                    .collect_vec()
                            })
                            .sorted_by(|&(_, priority1), &(_, priority2)| {
                                priority1.partial_cmp(&priority2).unwrap_or(Equal)
                            })
                            .map(|(modifier_id, _)| modifier_id)
                            .filter(|&modifier_id| {
                                let recipe = MODIFIERS.by_id[&modifier_id].recipe.clone();
                                if recipe.is_empty() {
                                    return false;
                                }

                                let remanining_recipe: BTreeSet<_> = recipe
                                    .difference(&queue.iter().copied().collect())
                                    .copied()
                                    .collect();
                                !remanining_recipe.is_empty()
                                    && remanining_recipe
                                        .iter()
                                        .all(|&modifier_id| has_modifier(&stash, modifier_id))
                            })
                    })
                    .map(|modifier_id| {
                        (
                            Some(modifier_id),
                            MODIFIERS.by_id[&modifier_id].recipe.clone(),
                        )
                    })
                    .collect_vec();
                modifier_ids.extend(
                    user_settings
                        .get_filler_modifier_ids()
                        .iter()
                        .filter(|&&modifier_id| has_modifier(&stash, modifier_id))
                        .map(|&modifier_id| (None, collection![modifier_id])),
                );

                let mut indices = vec![-1i32];
                let mut suggested_combo_and_value: Option<(Vec<ModifierId>, f32)> = None;
                loop {
                    if let Smart = user_settings.calculation_mode {
                        if time_before.elapsed().as_millis() > user_settings.time_budget_ms as u128
                        {
                            break;
                        }
                    }

                    if let Some(index) = indices.pop() {
                        if let Some((index, combo, value)) = modifier_ids
                            .iter()
                            .enumerate()
                            .skip((index + 1) as usize)
                            .find_map(|(index, (modifier_id, recipe))| {
                                let mut produced_modifier_ids = HashSet::<ModifierId>::new();
                                produced_modifier_ids.extend(get_produced_modifier_ids(&queue));
                                produced_modifier_ids.extend(
                                    indices
                                        .iter()
                                        .filter_map(|&index| modifier_ids[index as usize].0),
                                );

                                if let &Some(modifier_id) = modifier_id {
                                    produced_modifier_ids.insert(modifier_id);
                                }

                                let mut recipes = indices
                                    .iter()
                                    .map(|&index| modifier_ids[index as usize].1.clone())
                                    .collect_vec();
                                recipes.push(recipe.clone());

                                /*
                                let queue_set = queue.iter().copied().collect::<BTreeSet<_>>();
                                recipes = recipes
                                    .into_iter()
                                    .map(|recipe| recipe.difference(&queue_set).copied().collect())
                                    .collect();
                                */

                                let mut combo = recipes.iter().fold(
                                    BTreeSet::<ModifierId>::new(),
                                    |mut combo, recipe| {
                                        combo.extend(recipe);
                                        combo
                                    },
                                );
                                if combo.len() != recipes.iter().map(BTreeSet::len).sum::<usize>() {
                                    return None;
                                }

                                combo.extend(&queue);
                                if combo.len() > QUEUE_LENGTH {
                                    return None;
                                }

                                get_unordered_combo_value(
                                    user_settings,
                                    &queue,
                                    &combo,
                                    &produced_modifier_ids,
                                )
                                .map(|(combo, value)| (index, combo, value))
                            })
                        {
                            let (suggested_combo, suggested_value) =
                                suggested_combo_and_value.unwrap_or_default();
                            if combo.len() > suggested_combo.len()
                                || combo.len() == suggested_combo.len() && value > suggested_value
                            {
                                suggested_combo_and_value = Some((combo.clone(), value));
                            } else {
                                suggested_combo_and_value =
                                    Some((suggested_combo, suggested_value));
                            }

                            if combo.len() == QUEUE_LENGTH as usize {
                                if let Basic = user_settings.calculation_mode {
                                    break;
                                }
                            } else {
                                indices.push(index as i32);
                                indices.push(index as i32);
                            }
                        }
                    } else {
                        break;
                    }
                }

                suggested_combo_and_value.map(|(suggested_combo, _)| suggested_combo)
            })
            .map(|suggested_combo| suggested_combo[queue.len()])
    })
}
