import React from "react";
import { TransitionGroup } from "react-transition-group";
import { Lock } from "@mui/icons-material";
import { Box, Typography, Grow, Fade, Chip, Divider } from "@mui/material";
import { UserSettings, Modifiers, LabeledCombo } from "./Settings";
import WithLoading from "./WithLoading";
import { numberKeys } from ".";
import { DragDropContext, Droppable, Draggable, DropResult, ResponderProvided } from "react-beautiful-dnd";

type ComboRosterProps = {
    userSettings: UserSettings;
    setUserSettings: React.Dispatch<React.SetStateAction<UserSettings | undefined>>;
    modifiers: Modifiers;
};
const ComboRoster = ({ userSettings, setUserSettings, modifiers }: ComboRosterProps) => {
    const comboLabel = ({ label, id }: LabeledCombo) => {
        return label !== ''
            ? label
            : `Unnamed #${id}`;
    };
    const [unusedComboIds, setUnusedComboIds] = React.useState<number[]>(
        userSettings.comboCatalog.map(({ id }) => id).filter(id => !userSettings.comboRoster.includes(id)));
    const onDragEnd = (result: DropResult) => {
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
                const newUsedComboIds = [...userSettings!.comboRoster];
                newUsedComboIds.splice(source.index, 1);
                return {
                    ...userSettings!,
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
                const newUsedComboIds = [...userSettings!.comboRoster];
                newUsedComboIds.splice(destination.index, 0, draggedComboId);
                return {
                    ...userSettings!,
                    comboRoster: newUsedComboIds,
                };
            });
        }
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
    const unusedModifierIds = React.useMemo(() => {
        const getUsedModifierIds = (modifierId: number): number[] =>
            [modifierId, ...modifiers.byId[modifierId].recipe.flatMap(getUsedModifierIds)];
        let usedModifierIds = new Set(userSettings.comboRoster.flatMap(comboId =>
            userSettings.comboCatalog.find(({ id }) => id === comboId)?.combo.flatMap(getUsedModifierIds) ?? []));
        let unusedModifierIds = numberKeys(modifiers.byId)
            .filter(modifierId => !usedModifierIds.has(modifierId))
            .map(modifierId => modifiers.byId[modifierId])
            .sort((modifier1, modifier2) => modifier1.name.localeCompare(modifier2.name))
            .map(modifier => modifier.id);
        return unusedModifierIds;
    }, [modifiers, userSettings]);
    return (
        <WithLoading loaded={true} sx={{ width: 1, height: 1 }}>
            <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ width: 1, height: 360, display: 'flex' }}>
                    <DragDropContext onDragEnd={(result) => { onDragEnd(result) }}>
                        <Box sx={{ flex: 1, height: 1, mx: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <Typography variant='body2' sx={{ width: 150, my: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                Inactive combos
                            </Typography>
                            <Droppable droppableId='unused'>
                                {provided =>
                                    <Box ref={provided.innerRef} {...provided.droppableProps}
                                        sx={{ width: 150, height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                                        sx={{ width: 150, height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

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
            </Box >
        </WithLoading >
    );
};

export default ComboRoster;