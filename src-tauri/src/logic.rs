use crate::utils::{DiscSynchronized, JsonDiscSynchronized};
use crate::{collection, Cache};
use itertools::Itertools;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering::Equal;
use std::collections::hash_map::DefaultHasher;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet, VecDeque};
use std::error::Error;
use std::fs::File;
use std::hash::{Hash, Hasher};
use std::io::BufReader;
use std::time::{Instant, SystemTime};
use Effect::*;
use Reward::*;

const QUEUE_LENGTH: usize = 4;

const TIME_BUDGET_MS: u128 = 100;

const REROLL_MULTIPLIER: f64 = 0.25;

static REWARD_VALUES: Lazy<HashMap<Reward, u32>> = Lazy::new(|| {
    collection![
        Generic => 1,
        Armour => 1,
        Weapon => 1,
        Jewelry => 1,
        Gem => 5,
        Map => 10,
        DivinationCard => 25,
        Fragment => 10,
        Essence => 5,
        Harbinger => 25,
        Unique => 10,
        Delve => 5,
        Blight => 5,
        Ritual => 5,
        Currency => 25,
        Legion => 10,
        Breach => 5,
        Labyrinth => 5,
        Scarab => 25,
        Abyss => 5,
        Heist => 5,
        Expedition => 10,
        Delirium => 10,
        Metamorph => 5,
        Treant => 1,
    ]
});

pub static MODIFIERS: Lazy<Modifiers> = Lazy::new(Modifiers::new);

pub type ModifierId = u8;

#[derive(PartialEq, Eq, Hash, Clone, Copy, Debug, Serialize, Deserialize)]
pub enum Reward {
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

#[derive(PartialEq, Eq, Hash, Clone, Copy, Debug, Serialize, Deserialize)]
pub enum Effect {
    Reroll { count: usize },
    AdditionalReward,
    DoubledReward,
    Convert { to: Reward },
}

#[derive(PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Modifier {
    pub id: ModifierId,
    pub name: String,
    pub recipe: BTreeSet<ModifierId>,
    #[serde(skip_serializing)]
    pub rewards: HashMap<Reward, usize>,
    #[serde(skip_serializing)]
    pub effect: Option<Effect>,
}

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

pub type ComboId = u64;

#[derive(Hash, PartialEq, Eq, Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabeledCombo {
    pub id: ComboId,
    pub label: String,
    pub combo: Vec<ModifierId>,
}

impl LabeledCombo {
    pub fn new(id: u64, label: String, combo: Vec<ModifierId>) -> Self {
        Self { id, label, combo }
    }
}

#[derive(Hash, PartialEq, Eq, Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    pub combo_catalog: Vec<LabeledCombo>,
    pub combo_roster: Vec<ComboId>,
    pub forbidden_modifier_ids: BTreeSet<ModifierId>,
    pub hotkey: String,
}

impl UserSettings {
    pub fn get_filler_modifier_ids(&self) -> HashSet<ModifierId> {
        let used_modifier_ids = self
            .combo_roster
            .iter()
            .flat_map(|&combo_id| {
                self.combo_catalog.iter().find_map(|combo| {
                    if combo.id != combo_id {
                        None
                    } else {
                        Some(&combo.combo)
                    }
                })
            })
            .flat_map(|combo| {
                combo.iter().flat_map(|modifier_id| {
                    MODIFIERS.components[modifier_id]
                        .keys()
                        .chain(std::iter::once(modifier_id))
                })
            })
            .copied()
            .collect::<HashSet<_>>();
        MODIFIERS
            .by_id
            .keys()
            .filter(|&modifier_id| {
                !used_modifier_ids.contains(modifier_id)
                    && !self.forbidden_modifier_ids.contains(modifier_id)
            })
            .copied()
            .collect()
    }
}

impl DiscSynchronized for UserSettings {
    fn create_new() -> Self {
        Self {
            combo_catalog: vec![
                LabeledCombo::new(0, "All the uniques".to_owned(), vec![38, 60, 57, 58]),
                LabeledCombo::new(1, "I love expedition".to_owned(), vec![37, 38, 31, 4]),
                LabeledCombo::new(2, "$$$".to_owned(), vec![61, 62, 57, 59]),
            ],
            combo_roster: vec![0, 1, 2],
            forbidden_modifier_ids: collection![52, 56],
            hotkey: "alt + 1".to_owned(),
        }
    }

    fn file_name() -> &'static str {
        "archbroski\\settings.json"
    }

    fn save_impl(&self, writer: &mut std::io::BufWriter<File>) -> Result<(), Box<dyn Error>> {
        <Self as JsonDiscSynchronized>::save_impl(self, writer)
    }

    fn load_impl(reader: BufReader<File>) -> Result<Self, Box<dyn Error>> {
        <Self as JsonDiscSynchronized>::load_impl(reader)
    }
}

impl JsonDiscSynchronized for UserSettings {}

fn owned_modifier_count(stash: &BTreeMap<ModifierId, usize>, modifier_id: ModifierId) -> usize {
    stash.get(&modifier_id).copied().unwrap_or_default()
}

fn owns_modifier(stash: &BTreeMap<ModifierId, usize>, modifier_id: ModifierId) -> bool {
    owned_modifier_count(stash, modifier_id) > 0
}

fn get_combo_value(combo: &[ModifierId]) -> f32 {
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

        let rewards = modifiers.iter().map(|&modifier| &modifier.rewards).fold(
            HashMap::new(),
            |mut rewards, rewards_| {
                rewards.extend(rewards_);
                rewards
            },
        );
        let rewards = if let Some(&converted_reward) =
            effects.iter().fold(None, |converted_reward, &effect| {
                if let Convert { to } = effect {
                    Some(to)
                } else {
                    converted_reward
                }
            }) {
            collection! {converted_reward => rewards.values().sum()}
        } else {
            rewards
        };

        value
            + rewards
                .into_iter()
                .map(|(reward, reward_count)| {
                    let base_reward_value = REWARD_VALUES[&reward];
                    base_reward_value as f32
                        * (reward_count + additional_reward_count) as f32
                        * (if doubled_rewards { 2 } else { 1 }) as f32
                        * (1.0 + reroll_count as f64 * REROLL_MULTIPLIER) as f32
                })
                .sum::<f32>()
    })
}

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

fn get_unordered_combo_value(
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
                    get_combo_value(&combo_permutation),
                ))
            } else {
                None
            }
        })
        .max_by_key(|&(_, value)| value.floor() as i32)
}

pub fn suggest_modifier_id(
    cache: &mut Cache,
    user_settings: &UserSettings,
    stash: BTreeMap<ModifierId, usize>,
    queue: Vec<ModifierId>,
) -> Option<ModifierId> {
    let mut hasher = DefaultHasher::new();
    (user_settings.clone(), stash.clone(), queue.clone()).hash(&mut hasher);
    let cache_key = (
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        hasher.finish(),
    );
    *cache
        .suggested_modifier_ids
        .entry(cache_key)
        .or_insert_with(|| {
            cache.modified = true;
            let time_before = Instant::now();
            user_settings
                .combo_roster
                .iter()
                .flat_map(|&combo_id| {
                    user_settings.combo_catalog.iter().find_map(|combo| {
                        if combo.id != combo_id {
                            None
                        } else {
                            Some(&combo.combo)
                        }
                    })
                })
                .find(|combo| {
                    (0..queue.len()).all(|index| queue[index] == combo[index])
                        && combo
                            .iter()
                            .skip(queue.len())
                            .all(|&modifier_id| owns_modifier(&stash, modifier_id))
                })
                .cloned()
                .or_else(|| {
                    let filler_modifiers_ids = user_settings.get_filler_modifier_ids();
                    let mut modifier_ids = user_settings
                        .combo_roster
                        .iter()
                        .flat_map(|&combo_id| {
                            user_settings
                                .combo_catalog
                                .iter()
                                .find(|combo| combo.id != combo_id)
                        })
                        .enumerate()
                        .map(|(combo_index, LabeledCombo { combo, .. })| {
                            ((combo_index as f32 + 1.0), combo)
                        })
                        .flat_map(|(combo_priority, combo)| {
                            combo
                                .iter()
                                .flat_map(|&modifier_id| {
                                    let required_modifier_ids = &MODIFIERS.components[&modifier_id];
                                    let mut owned_modifier_ids = HashMap::new();

                                    let mut modifier_ids: VecDeque<_> =
                                        collection![(modifier_id, 0)];
                                    while let Some((modifier_id, parent_count)) =
                                        modifier_ids.pop_front()
                                    {
                                        let owned_count = owned_modifier_ids
                                            .entry(modifier_id)
                                            .or_insert_with(|| {
                                                stash.get(&modifier_id).copied().unwrap_or_default()
                                            });
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
                                                combo_priority as f32,
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
                                .filter(|(modifier_id, _, _)| {
                                    let recipe = MODIFIERS.by_id[modifier_id].recipe.clone();
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
                                            .all(|&modifier_id| owns_modifier(&stash, modifier_id))
                                })
                                .collect_vec()
                        })
                        .map(|(modifier_id, combo_priority, modifier_priority)| {
                            (modifier_id, combo_priority + modifier_priority)
                        })
                        .sorted_by(|&(_, priority1), &(_, priority2)| {
                            priority1.partial_cmp(&priority2).unwrap_or(Equal)
                        })
                        .map(|(modifier_id, _)| {
                            (
                                Some(modifier_id),
                                MODIFIERS.by_id[&modifier_id].recipe.clone(),
                            )
                        })
                        .collect_vec();
                    modifier_ids.extend(
                        filler_modifiers_ids
                            .iter()
                            .sorted_by(|&&modifier_id1, &&modifier_id2| {
                                Ord::cmp(
                                    &owned_modifier_count(&stash, modifier_id1),
                                    &owned_modifier_count(&stash, modifier_id2),
                                )
                                .reverse()
                            })
                            .filter(|&&modifier_id| owns_modifier(&stash, modifier_id))
                            .map(|&modifier_id| (None, collection![modifier_id])),
                    );

                    let mut indices = vec![-1i32];
                    let mut suggestion: Option<(Vec<ModifierId>, f32, usize)> = None;
                    loop {
                        if time_before.elapsed().as_millis() > TIME_BUDGET_MS
                            && suggestion.is_some()
                        {
                            break;
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

                                    let mut combo = recipes.iter().fold(
                                        BTreeSet::<ModifierId>::new(),
                                        |mut combo, recipe| {
                                            combo.extend(recipe);
                                            combo
                                        },
                                    );
                                    if combo.len()
                                        != recipes.iter().map(BTreeSet::len).sum::<usize>()
                                    {
                                        return None;
                                    }

                                    combo.extend(&queue);
                                    if combo.len() > QUEUE_LENGTH {
                                        return None;
                                    }

                                    get_unordered_combo_value(
                                        &queue,
                                        &combo,
                                        &produced_modifier_ids,
                                    )
                                    .map(|(combo, value)| (index, combo, value))
                                })
                            {
                                let filler_count = combo
                                    .iter()
                                    .filter(|&modifier_id| {
                                        filler_modifiers_ids.contains(modifier_id)
                                    })
                                    .count();
                                if combo.len() == QUEUE_LENGTH && filler_count == 0 {
                                    suggestion = Some((combo, value, 0));
                                    break;
                                }

                                if suggestion.is_none() || {
                                    let (combo_, value_, filler_count_) =
                                        suggestion.as_ref().unwrap();
                                    combo.len() > combo_.len()
                                        || combo.len() == combo_.len()
                                            && value > *value_
                                            && filler_count <= *filler_count_
                                } {
                                    suggestion = Some((combo, value, filler_count));
                                }

                                indices.push(index as i32);
                                indices.push(index as i32);
                            }
                        } else {
                            break;
                        }
                    }

                    suggestion.map(|(suggested_combo, _, _)| suggested_combo)
                })
                .map(|suggested_combo| suggested_combo[queue.len()])
        })
}
