import { AppBar, Box, IconButton, Toolbar, Typography, CircularProgress, Tab, Tabs } from '@mui/material';
import { Minimize } from '@mui/icons-material';
import { invoke, window } from '@tauri-apps/api';
import { useEffect, useState } from 'react';
import { Set } from 'typescript';
import { TabContext, TabPanel } from '@mui/lab';
import GeneralPage from './GeneralPage';
import CombosPage from './CombosPage';
import AboutPage from './AboutPage';

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
    const [userSettings, setUserSettings] = useState<UserSettings | undefined>(undefined);
    const [tab, setTab] = useState('general');
    useEffect(() => {
        window.getCurrent().show();
        Promise.all([
            invoke<UserSettings>('get_user_settings'),
            new Promise(resolve => setTimeout(resolve, 500))
        ]).then(([userSettings]) => setUserSettings(userSettings)).catch(console.error);
    }, []);
    return (
        <Box sx={{ width: 1, height: 1, display: 'flex' }}>
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
            {userSettings === undefined && (
                <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                    <Toolbar />
                    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <CircularProgress />
                    </Box>
                </Box>
            )}
            {userSettings !== undefined && (
                <TabContext value={tab}>
                    <Box sx={{ width: 150, display: 'flex', flexDirection: 'column' }}>
                        <Toolbar />
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
                        <Toolbar />
                        <TabPanel value={'general'} sx={{ width: 1, height: 1 }}>
                            <GeneralPage userSettings={userSettings} setUserSettings={setUserSettings} />
                        </TabPanel>
                        <TabPanel value={'combos'} sx={{ width: 1, height: 1 }}>
                            <CombosPage userSettings={userSettings} setUserSettings={setUserSettings} />
                        </TabPanel>
                        <TabPanel value={'about'} sx={{ width: 1, height: 1 }}>
                            <AboutPage />
                        </TabPanel>
                    </Box>
                </TabContext>
            )}
        </Box>
    );
}

export default Settings;