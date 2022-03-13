import React from 'react';
import { window, invoke } from '@tauri-apps/api';
import { AppBar, Box, IconButton, Toolbar, Typography, Tab, Tabs } from '@mui/material';
import { Minimize } from '@mui/icons-material';
import { TabContext, TabPanel } from '@mui/lab';
import GeneralSettings from './GeneralSettings';
import ComboSettings from './ComboSettings';
import AboutPage from './AboutPage';
import WithLoading from './WithLoading';

export type Modifier = {
    id: number,
    name: string,
    recipe: number[],
};

export type Modifiers = {
    byId: { [key: number]: Modifier },
    components: { [key: number]: { [key: number]: number } }
};

const defaultModifiers: Modifiers = {
    byId: {},
    components: {}
};

export type LabeledCombo = {
    id: number,
    label: string,
    combo: number[];
}

export type UserSettings = {
    comboCatalog: LabeledCombo[];
    comboRoster: number[];
    forbiddenModifierIds: number[];
    hotkey: string;
    showTiers: boolean;
};

const defaultUserSettings: UserSettings = {
    comboCatalog: [],
    comboRoster: [],
    forbiddenModifierIds: [],
    hotkey: '',
    showTiers: false,
};

export const ModifiersContext = React.createContext<[Modifiers] | undefined>(undefined);
export const UserSettingsContext = React.createContext<[UserSettings, React.Dispatch<React.SetStateAction<UserSettings>>] | undefined>(undefined);
const Settings = () => {
    const [load, setLoad] = React.useState<Promise<any> | undefined>(undefined);
    const [modifiers, setModifiers] = React.useState<Modifiers>(defaultModifiers);
    const [userSettings, setUserSettings] = React.useState<UserSettings>(defaultUserSettings);
    const [tab, setTab] = React.useState('general');
    React.useEffect(() => {
        const load = Promise.all([invoke<Modifiers>('get_modifiers'), invoke<UserSettings>('get_user_settings')]);
        setLoad(load);
        load
            .then(([modifiers, userSettings]: [Modifiers, UserSettings]) => {
                setModifiers(modifiers);
                setUserSettings(userSettings);
                window.getCurrent().show();
            })
            .catch(console.error);
    }, []);
    React.useEffect(() => {
        if (userSettings === undefined) {
            return;
        }

        console.log('user settings changed!');

        const timeoutId = setTimeout(() => {
            invoke('set_user_settings', {
                userSettings: {
                    ...userSettings,
                    combos: userSettings.comboCatalog.filter(({ combo }) => new Set(combo).size === combo.length)
                }
            }).catch(console.error);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [userSettings]);
    return (
        <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
            <AppBar position='fixed' sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar data-tauri-drag-region='true'>
                    <Typography variant='h6' component='div' color='inherit'>
                        Archbroski
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <IconButton size='large' color='inherit' onClick={() => { window.getCurrent().close() }}>
                        <Minimize />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <Toolbar />
            <TabContext value={tab}>
                <WithLoading
                    sx={{ width: 1, height: 1 }}
                    promise={load}
                    loadSuccessful={(
                        <Box sx={{ width: 1, height: 1 }}>
                            <ModifiersContext.Provider value={[modifiers]}>
                                <UserSettingsContext.Provider value={[userSettings, setUserSettings]}>
                                    <Box sx={{ width: 1, height: 1, display: 'flex' }}>
                                        <Box sx={{ width: 150, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                                            <Tabs
                                                orientation='vertical'
                                                value={tab}
                                                onChange={(_, value) => { setTab(value) }}
                                                sx={{ height: 1, borderRight: 1, borderColor: 'divider' }}>
                                                <Tab label='General' value={'general'} />
                                                <Tab label='Combos' value={'combos'} />
                                                <Tab label='About' value={'about'} />
                                            </Tabs>
                                        </Box>
                                        <Box sx={{ flexGrow: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                                            <TabPanel value={'general'} sx={{ width: 1, height: 1 }}>
                                                <GeneralSettings />
                                            </TabPanel>
                                            <TabPanel value={'combos'} sx={{ width: 1, height: 1, p: 0 }}>
                                                <ComboSettings />
                                            </TabPanel>
                                            <TabPanel value={'about'} sx={{ width: 1, height: 1 }}>
                                                <AboutPage />
                                            </TabPanel>
                                        </Box>
                                    </Box>
                                </UserSettingsContext.Provider>
                            </ModifiersContext.Provider>
                        </Box>
                    )}
                    loadFailed={(
                        <Box sx={{ width: 1, height: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            sadge
                        </Box>
                    )} />
            </TabContext>
        </Box>
    );
}

export default Settings;