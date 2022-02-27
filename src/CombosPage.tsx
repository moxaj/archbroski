import React from 'react';
import { TransitionGroup } from 'react-transition-group';
import { Add, Delete, Error, Help, Lock } from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import {
    Box, Chip, Collapse, Dialog, DialogContent, DialogContentText, DialogTitle, Divider,
    Fade, FormControl, Grow, IconButton, MenuItem, Select, Tooltip, Typography, Zoom
} from '@mui/material';
import WithLoading from './WithLoading';
import { UserSettings, Modifiers } from './Settings';


type CombosPageProps = {
    userSettings: UserSettings;
    setUserSettings: React.Dispatch<React.SetStateAction<UserSettings | undefined>>;
    modifiers: Modifiers;
};

const Transition = React.forwardRef((
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
            TransitionComponent={Transition}
            keepMounted
            open={open}
            onClose={onClose}>
            <DialogTitle>
                Help
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <Typography sx={{ mb: 1 }}>
                        Here you can define up to 4 combos you consider your <i>goals</i>. The top one has the highest priority,
                        the bottom one has the lowest. Unused modifiers may be locked / unlocked by clicking on them; locked
                        modifiers will <b>not</b> be suggested under any circumstances, while unlocked modifiers can be used
                        to free up some space or as 'fillers'.
                    </Typography>
                    <Typography>
                        One such combo could be
                    </Typography>
                    <Typography variant='caption'>
                        <code>Innocence-Touched + Brine King-touched + Kitava-touched + Treant Horde</code><br />
                    </Typography>
                    <Typography>
                        which yields a huge amount of currency items.
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography>
                        <b>archbroski</b> does not (yet) provide any convenient way to discover these - look
                        for them on the Path of Exile subreddit!
                    </Typography>
                </DialogContentText>
            </DialogContent>
        </Dialog>
    );
};

const CombosPage = ({ userSettings, setUserSettings, modifiers }: CombosPageProps) => {
    const [helpVisible, setHelpVisible] = React.useState(false);
    const sortedModifierIds = React.useMemo(() => {
        return Object.keys(modifiers.byId).sort((modifierId1, modifierId2) => {
            const modifierName1 = modifiers!.byId[+modifierId1].name;
            const modifierName2 = modifiers!.byId[+modifierId2].name;
            return modifierName1.localeCompare(modifierName2);
        });
    }, [modifiers]);
    const unusedModifierIds = React.useMemo(() => {
        const getUsedModifierIds = (modifierId: number): number[] => {
            const modifier = modifiers.byId[modifierId];
            return [modifierId, ...modifier.recipe.flatMap(getUsedModifierIds)];
        };
        let usedModifierIds = new Set(userSettings.combos.flatMap(([_, combo]) => combo.flatMap(getUsedModifierIds)));
        let unusedModifierIds = Object.keys(modifiers.byId)
            .filter(modifierId => !usedModifierIds.has(+modifierId))
            .map(modifierId => modifiers.byId[+modifierId])
            .sort((modifier1, modifier2) => modifier1.name.localeCompare(modifier2.name))
            .map(modifier => modifier.id);
        return unusedModifierIds;
    }, [userSettings]);
    const isComboValid = (userSettings: UserSettings, comboId: number) => {
        const [_, combo] = userSettings.combos.find(([comboId_, _]) => comboId_ === comboId)!;
        return new Set(combo).size === combo.length;
    };
    const addCombo = () => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                combos: [
                    ...userSettings!.combos,
                    [
                        1 + Math.max(0, ...userSettings!.combos.map(([comboId, _]) => comboId)),
                        [1, 2, 3, 4]
                    ]
                ]
            };
        });
    };
    const removeCombo = (comboId: number) => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                combos: userSettings!.combos.filter(([comboId_, _]) => comboId_ !== comboId)
            };
        });
    };
    const setModifierId = (comboId: number, modifierIdIndex: number, modifierId: number) => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                combos: userSettings!.combos.map(([comboId_, combo]) => {
                    if (comboId_ !== comboId) {
                        return [comboId_, combo];
                    } else {
                        return [comboId_, combo.map((modifierId_, modifierIdIndex_) =>
                            modifierIdIndex_ === modifierIdIndex ? modifierId : modifierId_)]
                    }
                })
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
    return (
        <WithLoading loaded={true} sx={{ width: 1, height: 1 }}>
            <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                <IconButton size='large' sx={{ position: 'absolute', right: 0, top: 0 }} onClick={() => { setHelpVisible(true) }}>
                    <Help />
                </IconButton>
                <HelpDialog open={helpVisible} onClose={() => { setHelpVisible(false) }} />
                <Box sx={{ width: 1, flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <TransitionGroup>
                        {userSettings.combos.map(([comboId, combo]) => (
                            <Collapse key={comboId}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Tooltip sx={{ visibility: 'hidden' }} title=''>
                                        <Error />
                                    </Tooltip>
                                    <IconButton sx={{ visibility: 'hidden' }}>
                                        <Delete />
                                    </IconButton>
                                    {combo.map((modifierId, modifierIdIndex) => (
                                        <FormControl key={modifierIdIndex} sx={{ width: 180, m: 0.5 }}>
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
                                    <IconButton disabled={userSettings.combos.length === 1} onClick={() => { removeCombo(comboId); }}>
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
                    <Fade in={userSettings.combos.length < 4}>
                        <IconButton onClick={() => { addCombo(); }}>
                            <Add />
                        </IconButton>
                    </Fade>
                </Box>
                <Divider />
                <Box sx={{ width: 1, height: 250, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                                            <Chip size='small' label={modifier.name} sx={{ m: 0.5 }}
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