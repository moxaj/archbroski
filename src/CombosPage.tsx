import { Add, AddCircle, Delete } from '@mui/icons-material';
import { Box, Divider, FormControl, IconButton, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { invoke } from '@tauri-apps/api';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { UserSettings } from './Settings';

type Modifier = {
    id: number,
    name: string,
    recipe: number[],
};

type Modifiers = {
    byId: { [key: number]: Modifier },
    components: { [key: number]: { [key: number]: number } }
};

type CombosPageProps = {
    userSettings: UserSettings;
    setUserSettings: Dispatch<SetStateAction<UserSettings | undefined>>;
};

const CombosPage = ({ userSettings, setUserSettings }: CombosPageProps) => {
    const [modifiers, setModifiers] = useState<Modifiers | undefined>(undefined);
    const setCombos = (combos: number[][]) => {
        setUserSettings(userSettings => ({
            ...userSettings!,
            combos
        }));
    };
    const setForbiddenModifierIds = (forbiddenModifierIds: number[]) => {
        setUserSettings(userSettings => ({
            ...userSettings!,
            forbiddenModifierIds
        }));
    };
    const getFillerModifiers = (modifiers: Modifiers) => {
        /*
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
    */
    };
    const removeCombo = (index: number) => {
        setUserSettings(userSettings => {
            let combos = userSettings!.combos;
            combos.splice(index, 1);
            return {
                ...userSettings!,
                combos
            };
        });
    }
    const sortedModifierIds = (modifiers: Modifiers) => {
        return Object.keys(modifiers.byId).sort((modifierId1, modifierId2) => {
            const modifierName1 = modifiers!.byId[+modifierId1].name;
            const modifierName2 = modifiers!.byId[+modifierId2].name;
            return modifierName1.localeCompare(modifierName2);
        });
    }
    useEffect(() => {
        invoke<Modifiers>('get_modifiers').then(setModifiers);
    }, []);
    return modifiers === undefined
        ? (
            <div>
                asdf
            </div>
        )
        : <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ width: 1, height: '70%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {userSettings.combos.map((combo, comboIndex) => (
                    <Box key={comboIndex} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <IconButton sx={{ visibility: 'hidden' }}>
                            <Delete />
                        </IconButton>
                        {combo.map((modifierId, modifierIdIndex) => (
                            <FormControl key={modifierIdIndex} sx={{ width: 170, m: 1 }}>
                                <InputLabel>{`Modifier ${modifierIdIndex + 1}`}</InputLabel>
                                <Select
                                    value={modifierId}
                                    label={`Modifier ${modifierIdIndex + 1}`}>
                                    {modifiers && sortedModifierIds(modifiers).map((modifierId, modifierIndex) => (
                                        <MenuItem key={modifierIndex} value={modifierId}>
                                            <Typography variant='body2'>
                                                {modifiers.byId[+modifierId].name}
                                            </Typography>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ))}
                        <IconButton onClick={() => { removeCombo(comboIndex); }}>
                            <Delete />
                        </IconButton>
                    </Box>
                ))}
                {userSettings.combos.length < 10 && (
                    <IconButton>
                        <Add />
                    </IconButton>
                )}
            </Box>
            <Divider />
            <Box>

            </Box>
        </Box>
};

export default CombosPage;