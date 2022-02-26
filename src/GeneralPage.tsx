import { Help } from '@mui/icons-material';
import { Box, Button, Divider, Grid, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/system';
import { useEffect, useState, Dispatch, SetStateAction } from 'react';
import { CalculationMode, RewardType, UserSettings } from './Settings';
import { tauri, window } from '@tauri-apps/api';

type GeneralPageProps = {
    userSettings: UserSettings;
    setUserSettings: Dispatch<SetStateAction<UserSettings | undefined>>;
}

const supportedKeys = [
    // Function keys
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
    // Numbers
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];

const GeneralPage = ({ userSettings, setUserSettings }: GeneralPageProps) => {
    const setHotkey = (hotkey: string) => {
        setUserSettings(userSettings => ({
            ...userSettings!,
            hotkey
        }));
    };
    const setCalculationMode = (calculationMode: CalculationMode) => {
        setUserSettings(userSettings => ({
            ...userSettings!,
            calculationMode
        }));
    };
    const setTimeBudgetMs = (timeBudgetMs: number) => {
        setUserSettings(userSettings => ({
            ...userSettings!,
            timeBudgetMs
        }));
    };
    const setPreference = (rewardType: string, value: number) => {
        setUserSettings(userSettings => ({
            ...userSettings!,
            preferences: { ...userSettings!.preferences, [rewardType]: value }
        }));
    };
    const [recordingHotkey, setRecordingHotkey] = useState(false);
    useEffect(() => {
        const keydownListener = (event: KeyboardEvent) => {
            if (recordingHotkey) {
                if (event.key === 'Escape') {
                    setRecordingHotkey(false);
                }
            }
        };
        document.addEventListener('keydown', keydownListener);
        return () => {
            document.removeEventListener('keydown', keydownListener);
        };
    }, [recordingHotkey]);
    useEffect(() => {
        const keydownListener = (event: KeyboardEvent) => {
            event.preventDefault();
            if (recordingHotkey) {
                console.log(event);
                if (event.key === 'Escape') {
                    setRecordingHotkey(false);
                } else {
                    let s = '';
                    if (event.ctrlKey) {
                        s += 'ctrl + ';
                    }

                    if (event.altKey) {
                        s += 'alt + ';
                    }

                    if (event.shiftKey) {
                        s += 'shift + '
                    }

                    if (event.code.startsWith('Key')) {
                        s += event.code.substring(3);
                    } else if (event.code.startsWith('Digit')) {
                        s += event.code.substring(5);
                    }

                    console.log(s);
                    tauri.invoke('test', { hotkey: s });
                    setRecordingHotkey(false);
                }
            }
        };
        document.addEventListener('keypress', keydownListener);
        return () => {
            document.removeEventListener('keypress', keydownListener);
        };
    }, [recordingHotkey]);
    return (
        <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography>
                        Hotkey
                    </Typography>
                    <Button variant='outlined' sx={{ width: 200 }} onClick={() => { setRecordingHotkey(true) }}>
                        {recordingHotkey
                            ? 'Press a key...'
                            : userSettings.hotkey}
                    </Button>
                </Box>
            </Box>
        </Box>

        /*
        <Grid container sx={{ flexGrow: 1 }}>
            <Grid item xs={1}>
                <Typography>
                    Hotkey
                </Typography>
            </Grid>
            <Grid item xs={3}>
                <Button variant='outlined' sx={{ width: 200 }}>{userSettings.hotkey}</Button>
            </Grid>
            <Grid item xs={3}>
                <Typography>
                    Calculation mode
                </Typography>
            </Grid>
            <Grid item xs={3}>
                <ToggleButtonGroup
                    sx={{ mx: 2 }}
                    color='primary'
                    value={mode}
                    exclusive
                    onChange={(_, mode) => updateMode(mode)}>
                    <ToggleButton value='simple'>Simple</ToggleButton>
                    <ToggleButton value='smart'>Smart</ToggleButton>
                </ToggleButtonGroup>
            </Grid>

            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>

            </Box>
            <Divider sx={{ m: 2 }} />
            <Typography sx={{ textAlign: 'center', mb: 4 }}>
                Relative reward values
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                {Object.keys(rewards).map(reward => (
                    <TextField key={reward} label={reward} type='number' variant='standard'
                        InputLabelProps={{
                            shrink: true,
                        }}
                        inputProps={{
                            min: 0, max: 10
                        }}
                        sx={{ width: 80, mx: 3, mb: 6 }}
                        disabled={mode === 'simple'}
                        value={rewards[reward]}
                        onChange={(event) => { updateRewards(reward as RewardType, +event.target.value) }} />
                ))}
            </Box>
        </Grid>
        */
    )
};

export default GeneralPage;