import React from 'react';
import { Help } from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { Box, Dialog, DialogContent, DialogContentText, DialogTitle, IconButton, Tab, Tabs, Zoom } from '@mui/material';
import { TabContext, TabPanel } from '@mui/lab';
import WithLoading from './WithLoading';
import { UserSettings, Modifiers } from './Settings';
import ComboCatalog from './ComboCatalog';
import ComboRoster from './ComboRoster';

export const DialogTransition = React.forwardRef((
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) => {
    return <Zoom ref={ref} {...props} />;
});
type HelpDialogProps = {
    open: boolean;
    onClose: () => void;
};
const HelpDialog = ({ open, onClose }: HelpDialogProps) => {
    return (
        <Dialog
            TransitionComponent={DialogTransition}
            keepMounted
            open={open}
            onClose={onClose}>
            <DialogTitle>
                Help
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    On the catalog tab, you may define up to 8 combos. On the roster tab, select which ones you'd like to have
                    as active combos. When you activate <b>archbroski</b>, it'll try to progress towards the active ones;
                    topmost with the highest, bottommost with the lowest priority.<br />
                    <br />
                    Modifiers not used by any of the active combos act as fillers, used to save stash space or to complement
                    recipes (to hit the zone cap of 4). You may also lock any of the unused modifiers; <b>archbroski</b> ignores
                    locked modifiers altogether.<br />
                    <br />
                    Any changes made are immediately in effect and synchronized to disk.
                </DialogContentText>
            </DialogContent>
        </Dialog>
    );
};

type ComboSettingsProps = {
    userSettings: UserSettings;
    setUserSettings: React.Dispatch<React.SetStateAction<UserSettings | undefined>>;
    modifiers: Modifiers;
};
const ComboSettings = ({ userSettings, setUserSettings, modifiers }: ComboSettingsProps) => {
    const [tab, setTab] = React.useState('catalog');
    const [helpDialogOpen, setHelpDialogOpen] = React.useState(false);
    return (
        <WithLoading loaded={true} sx={{ width: 1, height: 1 }}>
            <Box sx={{ width: 1, height: 1 }}>
                <HelpDialog open={helpDialogOpen} onClose={() => { setHelpDialogOpen(false) }} />
                <TabContext value={tab}>
                    <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                        <IconButton size='large' sx={{ position: 'absolute', right: 0, top: 0, zIndex: 1 }} onClick={() => { setHelpDialogOpen(true) }}>
                            <Help />
                        </IconButton>
                        <Tabs
                            value={tab}
                            centered
                            onChange={(_, value) => { setTab(value) }}
                            sx={{ width: 1, borderBottom: 1, borderColor: 'divider' }}>
                            <Tab label='Catalog' value={'catalog'} />
                            <Tab label='Roster' value={'roster'} />
                        </Tabs>
                        <TabPanel value={'catalog'} sx={{ flexGrow: 1, pt: 0 }}>
                            <ComboCatalog userSettings={userSettings} setUserSettings={setUserSettings} modifiers={modifiers} />
                        </TabPanel>
                        <TabPanel value={'roster'} sx={{ flexGrow: 1, pt: 0 }}>
                            <ComboRoster userSettings={userSettings} setUserSettings={setUserSettings} modifiers={modifiers} />
                        </TabPanel>
                    </Box>
                </TabContext>
            </Box>
        </WithLoading>
    );
};

export default ComboSettings;