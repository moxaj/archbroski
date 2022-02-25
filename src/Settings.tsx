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
    reward_type_values: { [key: string]: number };
    forbidde_modifier_ids: Set<number>;
};

type UserSettingsResult = {
    type: 'loading';
} | {
    type: 'failed';
} | {
    type: 'successful';
    userSettings: UserSettings;
}

const Settings = () => {
    const [state, setState] = useState<UserSettingsResult>({ type: 'loading' });
    const [page, setPage] = useState(0);

    useEffect(() => {
        window.getCurrent().show();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                let [userSettings, _] = await Promise.all([
                    tauri.invoke('get_user_settings'),
                    new Promise(resolve => setTimeout(resolve, 500))
                ]);
                setState({ type: 'successful', userSettings: userSettings as UserSettings });
            } catch (e) {
                setState({ type: 'failed' });
            }
        })()
    }, []);

    return (
        <Box sx={{ width: 1, height: 1, display: 'flex' }}>
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar data-tauri-drag-region='true'>
                    <Typography variant='h6' component='div' color='inherit'>
                        Archbro
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <IconButton size="large" color="inherit" onClick={() => { window.getCurrent().close() }}>
                        <Minimize />
                    </IconButton>
                </Toolbar>
            </AppBar>
            {state.type === 'loading' && (
                <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                    <Toolbar />
                    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <CircularProgress />
                    </Box>
                </Box>
            )}
            {state.type === 'failed' && (
                <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                    <Toolbar />
                    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <SentimentVeryDissatisfied sx={{ width: 100, height: 100, mb: 2 }} />
                        <Typography variant="h5">
                            Failed to load your settings!
                        </Typography>
                    </Box>
                </Box>
            )}
            {state.type === 'successful' && (
                <Box sx={{ display: 'flex' }}>
                    <Drawer
                        variant="permanent"
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
                    <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Toolbar />
                        <Box sx={{ p: 2 }}>
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