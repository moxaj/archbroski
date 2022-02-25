import { AppBar, Box, Drawer, IconButton, List, ListItem, Toolbar, Typography, ListItemIcon, ListItemText, CircularProgress } from '@mui/material';
import { Settings as SettingsIcon, Copyright, MenuBook, Minimize, SentimentVeryDissatisfied } from '@mui/icons-material';
import { tauri, window } from '@tauri-apps/api';
import { useEffect, useState } from 'react';
import SettingsPage from './SettingsPage';
import RecipesPage from './RecipesPage';
import AboutPage from './AboutPage';
import { Set } from 'typescript';

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

type UserSettings = {
    combos: number[][];
    forbiddenModifierIds: Set<number>;
    calculationMode: 'Simple' | 'Smart';
    preferences: { [key: string]: number };
};

/*
pub struct UserSettings {
    pub combos: Vec<Vec<ModifierId>>,
    pub forbidden_modifier_ids: HashSet<ModifierId>,
    pub calculation_mode: CalculationMode,
    pub preferences: HashMap<RewardType, usize>,
    pub time_budget_ms: u64,
    pub hotkey: String,
}
*/

const Settings = () => {
    const [userSettings, setUserSettings] = useState<UserSettings | undefined>(undefined);
    const [page, setPage] = useState(0);
    useEffect(() => {
        (async () => {
            let [userSettings] = await Promise.all([
                tauri.invoke<UserSettings>('get_user_settings'),
                new Promise(resolve => setTimeout(resolve, 500))
            ]);
            setUserSettings(userSettings);
        })()
    }, []);
    useEffect(() => {
        window.getCurrent().show();
    }, [userSettings]);
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
                <Box sx={{ width: 1, display: 'flex' }}>
                    <Drawer
                        variant='permanent'
                        sx={{
                            width: 170,
                            flexShrink: 0,
                            [`& .MuiDrawer-paper`]: { width: 170, boxSizing: 'border-box' },
                        }}>
                        <Toolbar />
                        <List>
                            <ListItem button key='settings' onClick={() => { setPage(0) }}>
                                <ListItemIcon>
                                    <SettingsIcon />
                                </ListItemIcon>
                                <ListItemText primary={'Settings'} />
                            </ListItem>
                            <ListItem button key='recipes' onClick={() => { setPage(1) }}>
                                <ListItemIcon>
                                    <MenuBook />
                                </ListItemIcon>
                                <ListItemText primary={'Recipes'} />
                            </ListItem>
                            <ListItem button key='about' onClick={() => { setPage(2) }}>
                                <ListItemIcon>
                                    <Copyright />
                                </ListItemIcon>
                                <ListItemText primary={'About'} />
                            </ListItem>
                        </List>
                    </Drawer>
                    <Box component='main' sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Toolbar />
                        <Box sx={{ flexGrow: 1, p: 2 }}>
                            {page === 0 && <SettingsPage />}
                            {page === 1 && <RecipesPage />}
                            {page === 2 && <AboutPage />}
                        </Box>
                    </Box>
                </Box>
            )}
        </Box>
    );
}

export default Settings;