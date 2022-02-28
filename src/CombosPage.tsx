import React from 'react';
import { TransitionGroup } from 'react-transition-group';
import { Add, Delete, Error, Help, Lock } from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import {
    Box, Chip, Collapse, Dialog, DialogContent, DialogContentText, DialogTitle, Divider,
    Fade, FormControl, Grow, IconButton, MenuItem, Select, Switch, TextField, Tooltip, Typography, Zoom
} from '@mui/material';
import WithLoading from './WithLoading';
import { UserSettings, Modifiers } from './Settings';
import { numberKeys } from '.';

type CombosPageProps = {
    userSettings: UserSettings;
    setUserSettings: React.Dispatch<React.SetStateAction<UserSettings | undefined>>;
    modifiers: Modifiers;
};

const HelpDialogTransition = React.forwardRef((
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) => {
    return <Zoom ref={ref} {...props} />;
});

const HelpDialog = ({ open, onClose }: { open: boolean, onClose: () => void }) => {
    return (
        <Dialog
            TransitionComponent={HelpDialogTransition}
            keepMounted
            open={open}
            onClose={onClose}>
            <DialogTitle>
                Help
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Here you can define up to 4 combos you consider your <i>goals</i>. The top one has the highest priority,
                    the bottom one has the lowest. Unused modifiers may be locked / unlocked by clicking on them; locked
                    modifiers will <b>not</b> be suggested under any circumstances, while unlocked modifiers can be used
                    to free up some space or as fillers.
                </DialogContentText>
            </DialogContent>
        </Dialog>
    );
};

const CombosPage = ({ userSettings, setUserSettings, modifiers }: CombosPageProps) => {
    const [helpVisible, setHelpVisible] = React.useState(false);
    const sortedModifierIds = React.useMemo(() => {
        return numberKeys(modifiers.byId).sort((modifierId1, modifierId2) => {
            const modifierName1 = modifiers.byId[modifierId1].name;
            const modifierName2 = modifiers.byId[modifierId2].name;
            return modifierName1.localeCompare(modifierName2);
        });
    }, [modifiers]);
    const unusedModifierIds = React.useMemo(() => {
        const getUsedModifierIds = (modifierId: number): number[] =>
            [modifierId, ...modifiers.byId[modifierId].recipe.flatMap(getUsedModifierIds)];
        let usedModifierIds = new Set(userSettings.labeledCombos.flatMap(({ enabled, combo }) => !enabled ? [] : combo.flatMap(getUsedModifierIds)));
        let unusedModifierIds = numberKeys(modifiers.byId)
            .filter(modifierId => !usedModifierIds.has(modifierId))
            .map(modifierId => modifiers.byId[modifierId])
            .sort((modifier1, modifier2) => modifier1.name.localeCompare(modifier2.name))
            .map(modifier => modifier.id);
        return unusedModifierIds;
    }, [modifiers, userSettings]);
    const isComboValid = (userSettings: UserSettings, comboId: number) => {
        const { combo } = userSettings.labeledCombos.find(({ id }) => id === comboId)!;
        return new Set(combo).size === combo.length;
    };
    const addCombo = () => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                labeledCombos: [
                    ...userSettings!.labeledCombos,
                    {
                        id: 1 + Math.max(0, ...userSettings!.labeledCombos.map(({ id }) => id)),
                        label: '',
                        combo: [4, 5, 7, 2],
                        enabled: true
                    }
                ]
            };
        });
    };
    const removeCombo = (comboId: number) => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                labeledCombos: userSettings!.labeledCombos.filter(({ id }) => id !== comboId)
            };
        });
    };
    const setLabel = (comboId: number, newLabel: string) => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                labeledCombos: userSettings!.labeledCombos.map(({ id, label, enabled, combo }) => ({
                    id,
                    label: id !== comboId ? label : newLabel,
                    enabled,
                    combo
                }))
            };
        });
    };
    const setModifierId = (comboId: number, modifierIdIndex: number, modifierId: number) => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                labeledCombos: userSettings!.labeledCombos.map(({ id, label, enabled, combo }) => ({
                    id,
                    label,
                    enabled,
                    combo: id !== comboId ? combo : combo.map((modifierId_, modifierIdIndex_) =>
                        modifierIdIndex_ === modifierIdIndex ? modifierId : modifierId_)
                }))
            };
        });
    };
    const toggleForbiddenModifierId = (modifierId: number) => {
        setUserSettings(userSettings => {
            const forbiddenModifierIds = userSettings!.forbiddenModifierIds;
            return {
                ...userSettings!,
                forbiddenModifierIds: forbiddenModifierIds.includes(modifierId)
                    ? forbiddenModifierIds.filter(modifierId_ => modifierId_ !== modifierId)
                    : [...forbiddenModifierIds, modifierId]
            }
        });
    };
    const toggleComboEnabled = (comboId: number, newEnabled: boolean) => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                labeledCombos: userSettings!.labeledCombos.map(({ id, label, enabled, combo }) => ({
                    id,
                    label,
                    enabled: id !== comboId ? enabled : newEnabled,
                    combo
                }))
            };
        });
    }
    return (
        <WithLoading loaded={true} sx={{ width: 1, height: 1 }}>
            <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <IconButton size='large' sx={{ position: 'absolute', right: 0, top: 0 }} onClick={() => { setHelpVisible(true) }}>
                    <Help />
                </IconButton>
                <HelpDialog open={helpVisible} onClose={() => { setHelpVisible(false) }} />
                <Box sx={{ width: 1, height: 380, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', overflow: 'auto' }}>
                    <TransitionGroup>
                        {userSettings.labeledCombos.map(({ id: comboId, label, enabled, combo }) => (
                            <Collapse key={comboId}>
                                <Box sx={{ display: 'flex', alignItems: 'center', my: 1 }}>
                                    <Switch checked={enabled} onChange={(event) => { toggleComboEnabled(comboId, event.target.checked); }} />
                                    <TextField
                                        variant='outlined'
                                        label='Label'
                                        spellCheck={false}
                                        sx={{ width: 150, mx: 1 }}
                                        disabled={!enabled}
                                        defaultValue={label}
                                        onBlur={(event) => { setLabel(comboId, event.target.value) }} />
                                    {combo.map((modifierId, modifierIdIndex) => (
                                        <FormControl key={modifierIdIndex} disabled={!enabled} sx={{ width: 180, mx: 0.3, my: 0.2 }}>
                                            <Select value={modifierId}>
                                                {modifiers && sortedModifierIds.map((modifierId_, modifierIdIndex_) => (
                                                    <MenuItem key={modifierIdIndex_} value={modifierId_}
                                                        onClick={() => { setModifierId(comboId, modifierIdIndex, +modifierId_) }}>
                                                        <Typography variant='body2'>
                                                            {modifiers.byId[+modifierId_].name}
                                                        </Typography>
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    ))}
                                    <IconButton disabled={userSettings.labeledCombos.length === 1 || !enabled} onClick={() => { removeCombo(comboId); }}>
                                        <Delete />
                                    </IconButton>
                                    <Tooltip
                                        title='Duplicate modifiers are not allowed!'>
                                        <Zoom
                                            in={!isComboValid(userSettings!, comboId)}
                                            easing={{
                                                enter: "cubic-bezier(0.800, 1.000, 0.500, 2.000)",
                                                exit: "linear"
                                            }}
                                            timeout={250}>
                                            <Error color='error' />
                                        </Zoom>
                                    </Tooltip>
                                </Box>
                            </Collapse>
                        ))}
                    </TransitionGroup>
                    <Fade in={userSettings.labeledCombos.length < 10}>
                        <IconButton onClick={() => { addCombo(); }}>
                            <Add />
                        </IconButton>
                    </Fade>
                </Box>
                <Divider />
                <Box sx={{ width: 1, flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography variant='body2' sx={{ m: 1, textTransform: 'uppercase' }}>
                        Unused modifiers
                    </Typography>
                    <Box sx={{
                        width: 1, flexGrow: 1, display: 'flex', justifyContent: 'flex-start',
                        alignContent: 'flex-start', flexWrap: 'wrap'
                    }}>
                        <TransitionGroup component={null}>
                            {unusedModifierIds.map(modifierId => {
                                let modifier = modifiers.byId[modifierId];
                                return (
                                    <Grow key={modifier.name}>
                                        <Box sx={{ position: 'relative' }}>
                                            <Fade in={userSettings!.forbiddenModifierIds.includes(modifierId)}>
                                                <Lock sx={{
                                                    position: 'absolute', right: 0, top: 0, fontSize: '14px',
                                                    transform: 'translateX(20%)'
                                                }} />
                                            </Fade>
                                            <Chip size='small' label={modifier.name} sx={{ m: 0.3 }}
                                                onClick={() => { toggleForbiddenModifierId(modifierId) }} />
                                        </Box>
                                    </Grow>
                                );
                            })}
                        </TransitionGroup>
                    </Box>
                </Box>
            </Box>
        </WithLoading>
    );
};

export default CombosPage;