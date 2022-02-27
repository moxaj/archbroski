import React from 'react';
import { window, invoke } from '@tauri-apps/api';
import { AppBar, Box, IconButton, Toolbar, Typography, CircularProgress, Tab, Tabs } from '@mui/material';
import { Minimize } from '@mui/icons-material';
import { TabContext, TabPanel } from '@mui/lab';
import GeneralPage from './GeneralPage';
import CombosPage from './CombosPage';
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

export type RewardType = 'Generic'
    | 'Armour'
    | 'Weapon'
    | 'Jewelry'
    | 'Gem'
    | 'Map'
    | 'DivinationCard'
    | 'Fragment'
    | 'Essence'
    | 'Harbinger'
    | 'Unique'
    | 'Delve'
    | 'Blight'
    | 'Ritual'
    | 'Currency'
    | 'Legion'
    | 'Breach'
    | 'Labyrinth'
    | 'Scarab'
    | 'Abyss'
    | 'Heist'
    | 'Expedition'
    | 'Delirium'
    | 'Metamorph';

export type CalculationMode = 'Simple' | 'Smart';

export type UserSettings = {
    combos: number[][];
    forbiddenModifierIds: number[];
    calculationMode: CalculationMode;
    preferences: { [key: string]: number };
    timeBudgetMs: number;
    hotkey: string;
};

const Settings = () => {
    const [userSettings, setUserSettings] = React.useState<UserSettings | undefined>(undefined);
    const [modifiers, setModifiers] = React.useState<Modifiers | undefined>(undefined);
    const [tab, setTab] = React.useState('general');
    React.useEffect(() => {
        Promise
            .all([
                invoke<UserSettings>('get_user_settings'),
                invoke<Modifiers>('get_modifiers')
            ])
            .then(([userSettings, modifiers]) => {
                setUserSettings(userSettings);
                setModifiers(modifiers);
                window.getCurrent().show();
            })
            .catch(console.error);
    }, []);
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
                <WithLoading loaded={modifiers !== undefined} sx={{ width: 1, height: 1 }}>
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
                                <GeneralPage userSettings={userSettings!} setUserSettings={setUserSettings} />
                            </TabPanel>
                            <TabPanel value={'combos'} sx={{ width: 1, height: 1 }}>
                                <CombosPage userSettings={userSettings!} setUserSettings={setUserSettings} modifiers={modifiers!} />
                            </TabPanel>
                            <TabPanel value={'about'} sx={{ width: 1, height: 1 }}>
                                <AboutPage />
                            </TabPanel>
                        </Box>
                    </Box>
                </WithLoading>
            </TabContext>
        </Box>
    );
}

export default Settings;