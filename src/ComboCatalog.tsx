import React from "react";
import { Delete, Add, Error } from "@mui/icons-material";
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, TextField, Select, MenuItem, Typography, Box, IconButton, Tooltip, Zoom, Fade } from "@mui/material";
import { numberKeys } from ".";
import { LabeledCombo, UserSettings, Modifiers } from "./Settings";
import WithLoading from "./WithLoading";
import { DialogTransition } from "./ComboSettings";

type DeleteComboDialogProps = {
    combo?: LabeledCombo;
    open: boolean;
    onClose: (confirmed: boolean) => void;
};
const DeleteComboDialog = ({ combo, open, onClose }: DeleteComboDialogProps) => {
    let label = combo?.label ?? '';
    if (label === '') {
        label = `Unnamed #${combo?.id}`;
    }

    return (
        <Dialog
            TransitionComponent={DialogTransition}
            keepMounted
            open={open}
            onClose={() => onClose(false)}>
            <DialogTitle>
                Confirm delete
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Would you really like to delete '{label}'?
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose(false)}>
                    Cancel
                </Button>
                <Button onClick={() => onClose(true)}>
                    Confirm
                </Button>
            </DialogActions>
        </Dialog>
    );
};

type ComboCatalogProps = {
    userSettings: UserSettings;
    setUserSettings: React.Dispatch<React.SetStateAction<UserSettings | undefined>>;
    modifiers: Modifiers;
};
const ComboCatalog = ({ userSettings, setUserSettings, modifiers }: ComboCatalogProps) => {
    const [deleteComboDialogOpen, setDeleteComboDialogOpen] = React.useState(false);
    const [comboToDelete, setComboToDelete] = React.useState<LabeledCombo | undefined>(undefined);
    const sortedModifierIds = React.useMemo(() => {
        return numberKeys(modifiers.byId).sort((modifierId1, modifierId2) => {
            const modifierName1 = modifiers.byId[modifierId1].name;
            const modifierName2 = modifiers.byId[modifierId2].name;
            return modifierName1.localeCompare(modifierName2);
        });
    }, [modifiers]);
    const isComboValid = (combo: number[]) => {
        return new Set(combo).size === combo.length;
    };
    const addCombo = () => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                comboCatalog: [
                    ...userSettings!.comboCatalog,
                    {
                        id: 1 + Math.max(0, ...userSettings!.comboCatalog.map(({ id }) => id)),
                        label: '',
                        combo: [4, 5, 7, 2],
                    }
                ]
            };
        });
    };
    const deleteCombo = (comboId: number) => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                comboCatalog: userSettings!.comboCatalog.filter(({ id }) => id !== comboId),
                comboRoster: userSettings!.comboRoster.filter(id => id !== comboId),
            };
        });
    };
    const setComboLabel = (comboId: number, label: string) => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                comboCatalog: userSettings!.comboCatalog.map(({ id, label: label_, combo }) => ({
                    id,
                    label: id !== comboId ? label_ : label,
                    combo
                }))
            };
        });
    };
    const setModifierId = (comboId: number, modifierIdIndex: number, modifierId: number) => {
        setUserSettings(userSettings => {
            return {
                ...userSettings!,
                comboCatalog: userSettings!.comboCatalog.map(({ id, label, combo }) => ({
                    id,
                    label,
                    combo: id !== comboId ? combo : combo.map((modifierId_, modifierIdIndex_) =>
                        modifierIdIndex_ === modifierIdIndex ? modifierId : modifierId_)
                }))
            };
        });
    };
    const initiateDeleteCombo = (combo: LabeledCombo) => {
        setComboToDelete(combo);
        setDeleteComboDialogOpen(true);
    };
    const confirmDeleteCombo = (comboId: number, confirmed: boolean) => {
        setDeleteComboDialogOpen(false);
        if (confirmed) {
            deleteCombo(comboId);
        }
    };
    return (
        <WithLoading loaded={true} sx={{ width: 1, height: 1 }}>
            <Box sx={{ width: 1, height: 1 }}>
                <DeleteComboDialog combo={comboToDelete} open={deleteComboDialogOpen} onClose={confirmed => confirmDeleteCombo(comboToDelete?.id!, confirmed ?? false)} />
                <TableContainer sx={{ width: 1, height: 550, overflow: 'overlay' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Modifier 1</TableCell>
                                <TableCell>Modifier 2</TableCell>
                                <TableCell>Modifier 3</TableCell>
                                <TableCell>Modifier 4</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {userSettings.comboCatalog.map(labeledCombo => {
                                const { id: comboId, label, combo } = labeledCombo;
                                return (
                                    <TableRow key={comboId} sx={{ 'td, th': { border: 0 } }}>
                                        <TableCell>
                                            <TextField
                                                variant='standard'
                                                sx={{ width: 140 }}
                                                spellCheck={false}
                                                placeholder={`Unnamed #${comboId}`}
                                                defaultValue={label}
                                                onBlur={(event) => { setComboLabel(comboId, event.target.value) }} />
                                        </TableCell>
                                        {combo.map((modifierId, modifierIdIndex) => (
                                            <TableCell key={modifierIdIndex}>
                                                <Select variant='standard' value={modifierId} sx={{ width: 160 }}>
                                                    {modifiers && sortedModifierIds.map((modifierId_, modifierIdIndex_) => (
                                                        <MenuItem key={modifierIdIndex_} value={modifierId_}
                                                            onClick={() => { setModifierId(comboId, modifierIdIndex, +modifierId_) }}>
                                                            <Typography variant='body2'>
                                                                {modifiers.byId[+modifierId_].name}
                                                            </Typography>
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </TableCell>
                                        ))}
                                        <TableCell sx={{ px: 0 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <IconButton
                                                    sx={{ alignSelf: 'center', mr: 1 }}
                                                    disabled={userSettings.comboCatalog.length === 1}
                                                    onClick={() => { initiateDeleteCombo(labeledCombo); }}>
                                                    <Delete />
                                                </IconButton>
                                                <Tooltip
                                                    title='Duplicate modifiers are not allowed!'>
                                                    <Zoom
                                                        in={!isComboValid(combo)}
                                                        easing={{
                                                            enter: "cubic-bezier(0.800, 1.000, 0.500, 2.000)",
                                                            exit: "linear"
                                                        }}
                                                        timeout={250}>
                                                        <Error color='error' sx={{ mr: 2 }} />
                                                    </Zoom>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
                <Fade in={userSettings.comboCatalog.length < 10}>
                    <IconButton sx={{ alignSelf: 'center' }} onClick={() => { addCombo(); }}>
                        <Add />
                    </IconButton>
                </Fade>
            </Box>
        </WithLoading>
    );
};

export default ComboCatalog;