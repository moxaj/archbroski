import React from 'react';
import { TransitionGroup } from 'react-transition-group';
import { Lock, Star, SyncAlt } from '@mui/icons-material';
import { Box, Typography, Chip, Divider, Zoom, FormControlLabel, Switch, Fade } from '@mui/material';
import { Modifiers, LabeledCombo, UserSettingsContext, ModifiersContext } from './Settings';
import WithLoading from './WithLoading';
import { numberKeys } from '.';
import { DragDropContext, Droppable, Draggable, DropResult, DragStart } from 'react-beautiful-dnd';

const comboLabel = ({ label, id }: LabeledCombo) => {
    return label !== ''
        ? label
        : `Unnamed #${id}`;
};
const getUsedModifierIds = (modifiers: Modifiers, modifierId: number): number[] =>
    [modifierId, ...modifiers.byId[modifierId].recipe.flatMap(modifierId_ => getUsedModifierIds(modifiers, modifierId_))];

const ComboRoster = () => {
    const [modifiers] = React.useContext(ModifiersContext)!;
    const [userSettings, setUserSettings] = React.useContext(UserSettingsContext)!;

    const toggleForbiddenModifierId = (modifierId: number) => {
        setUserSettings(userSettings => {
            const forbiddenModifierIds = userSettings.forbiddenModifierIds;
            return {
                ...userSettings,
                forbiddenModifierIds: forbiddenModifierIds.includes(modifierId)
                    ? forbiddenModifierIds.filter(modifierId_ => modifierId_ !== modifierId)
                    : [...forbiddenModifierIds, modifierId]
            }
        });
    };
    const [unusedComboIds, setUnusedComboIds] = React.useState<number[]>(
        userSettings.comboCatalog.map(({ id }) => id).filter(id => !userSettings.comboRoster.includes(id)));
    const [draggedComboId, setDraggedComboId] = React.useState<number | undefined>(undefined);
    const unusedModifierIds = React.useMemo(() => {
        let usedModifierIds = new Set(userSettings.comboRoster.flatMap(comboId =>
            userSettings.comboCatalog.find(({ id }) => id === comboId)?.combo.flatMap(modifierId => getUsedModifierIds(modifiers, modifierId)) ?? []));
        let unusedModifierIds = numberKeys(modifiers.byId)
            .filter(modifierId => !usedModifierIds.has(modifierId))
            .map(modifierId => modifiers.byId[modifierId])
            .sort((modifier1, modifier2) => modifier1.name.localeCompare(modifier2.name))
            .map(modifier => modifier.id);
        return unusedModifierIds;
    }, [modifiers, userSettings]);
    const modifierIdsUsedByDragged = React.useMemo(() => {
        return new Set(draggedComboId === undefined ? [] : userSettings.comboCatalog
            .find(({ id }) => id === draggedComboId)
            ?.combo.flatMap(modifierId => getUsedModifierIds(modifiers, modifierId)));
    }, [modifiers, userSettings, draggedComboId]);
    const modifierTier = React.useCallback((modifierId: number): number => {
        const { recipe } = modifiers.byId[modifierId];
        return recipe.length === 0 ? 1 : 1 + Math.max(...recipe.map(modifierId_ => modifierTier(modifierId_)));
    }, [modifiers]);
    const onDragStart = (result: DragStart) => {
        setDraggedComboId(+result.draggableId);
    };
    const onDragEnd = (result: DropResult) => {
        setDraggedComboId(undefined);
        const { source, destination, draggableId: draggableIdString } = result;
        if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
            return;
        }

        let draggedComboId = +draggableIdString;
        if (source.droppableId === 'unused') {
            setUnusedComboIds(unusedComboIds => {
                const newUnusedComboIds = [...unusedComboIds];
                newUnusedComboIds.splice(source.index, 1);
                return newUnusedComboIds;
            });
        } else {
            setUserSettings(userSettings => {
                const newUsedComboIds = [...userSettings.comboRoster];
                newUsedComboIds.splice(source.index, 1);
                return {
                    ...userSettings,
                    comboRoster: newUsedComboIds,
                };
            });
        }

        if (destination.droppableId === 'unused') {
            setUnusedComboIds(unusedComboIds => {
                const newUnusedComboIds = [...unusedComboIds];
                newUnusedComboIds.splice(destination.index, 0, draggedComboId);
                return newUnusedComboIds;
            });
        } else {
            setUserSettings(userSettings => {
                const newUsedComboIds = [...userSettings.comboRoster];
                newUsedComboIds.splice(destination.index, 0, draggedComboId);
                return {
                    ...userSettings,
                    comboRoster: newUsedComboIds,
                };
            });
        }
    };
    const unusedModifierIdOpacity = (draggedComboId: number | undefined, modifierId: number, modifierIdsUsedByDragged: Set<number>) => {
        return draggedComboId === undefined
            ? 1
            : modifierIdsUsedByDragged.has(modifierId)
                ? 0.2
                : 1;
    };
    const setShowTiers = (showTiers: boolean) => {
        setUserSettings(userSettings => (
            {
                ...userSettings,
                showTiers
            }
        ));
    };
    return (
        <WithLoading sx={{ width: 1, height: 1 }} loadSuccessful={(
            <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ position: 'relative', width: 1, height: 300, display: 'flex' }}>
                    <SyncAlt color='primary' sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) scale(75%)'
                    }} />
                    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                        <Box sx={{ flex: 1, height: 1, mx: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <Typography variant='body2' sx={{ width: 150, my: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                Inactive combos
                            </Typography>
                            <Droppable droppableId='unused'>
                                {provided =>
                                    <Box ref={provided.innerRef} {...provided.droppableProps}
                                        sx={{ width: 150, height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        {
                                            unusedComboIds.map((comboId, comboIndex) => (
                                                <Draggable key={comboId} draggableId={'' + comboId} index={comboIndex}>
                                                    {provided => (
                                                        <Chip ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                                            size='small'
                                                            label={comboLabel(userSettings.comboCatalog.find(({ id }) => id === comboId)!)}
                                                            sx={{ width: 150, minHeight: 'min-content', my: 0.5 }} />
                                                    )}
                                                </Draggable>
                                            ))
                                        }
                                        {provided.placeholder}
                                    </Box>
                                }
                            </Droppable>
                        </Box>
                        <Divider orientation='vertical' />
                        <Box sx={{ flex: 1, height: 1, mx: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <Typography variant='body2' sx={{ width: 150, my: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                Active combos
                            </Typography>
                            <Droppable droppableId='used'>
                                {provided =>
                                    <Box ref={provided.innerRef} {...provided.droppableProps}
                                        sx={{ width: 150, height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                                        {
                                            userSettings.comboRoster.map((comboId, comboIndex) => (
                                                <Draggable key={comboId} draggableId={'' + comboId} index={comboIndex}>
                                                    {provided => (
                                                        <Chip ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                                            size='small'
                                                            label={comboLabel(userSettings.comboCatalog.find(({ id }) => id === comboId)!)}
                                                            sx={{ width: 150, minHeight: 'min-content', my: 0.5 }} />
                                                    )}
                                                </Draggable>
                                            ))
                                        }
                                        {provided.placeholder}
                                    </Box>
                                }
                            </Droppable>
                        </Box>
                    </DragDropContext>
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
                                    <Zoom key={modifier.name}>
                                        <Box sx={{ position: 'relative' }}>
                                            <Box sx={{
                                                transition: (theme) => theme.transitions.create(['opacity', 'transform']),
                                                opacity: unusedModifierIdOpacity(draggedComboId, modifierId, modifierIdsUsedByDragged)
                                            }}>
                                                <Zoom in={userSettings.forbiddenModifierIds.includes(modifierId)}>
                                                    <Lock sx={{
                                                        position: 'absolute', right: 0, top: 0, fontSize: '14px',
                                                        transform: 'translateX(20%)',
                                                        zIndex: 1
                                                    }} />
                                                </Zoom>
                                                <Fade in={userSettings.showTiers}>
                                                    <Box sx={{
                                                        position: 'absolute', top: 0, left: '50%',
                                                        transform: 'translate(-50%, -40%) scale(0.3)',
                                                        display: 'flex'
                                                    }}>
                                                        {[...Array(modifierTier(modifierId))].map((_, index) => (
                                                            <Star key={index} color='secondary' />
                                                        ))}
                                                    </Box>
                                                </Fade>
                                                <Chip
                                                    size='small'
                                                    label={modifier.name}
                                                    sx={{ m: 0.5 }}
                                                    onClick={() => { toggleForbiddenModifierId(modifierId) }} />
                                            </Box>
                                        </Box>
                                    </Zoom>
                                );
                            })}
                        </TransitionGroup>
                    </Box>
                </Box>
                <Box sx={{ width: 1, display: 'flex', alignItems: 'center' }}>
                    <FormControlLabel
                        control={<Switch checked={userSettings.showTiers} onChange={event => setShowTiers(event.target.checked)} />}
                        label="Show tiers" />
                </Box>
            </Box >
        )} />
    );
};

export default ComboRoster;