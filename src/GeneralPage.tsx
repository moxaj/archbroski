import React from 'react';
import { invoke } from '@tauri-apps/api';
import { Box, Button, Typography } from '@mui/material';
import { CalculationMode, UserSettings } from './Settings';
import WithLoading from './WithLoading';

type GeneralPageProps = {
    userSettings: UserSettings;
    setUserSettings: React.Dispatch<React.SetStateAction<UserSettings | undefined>>;
}

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
    const [recordingHotkey, setRecordingHotkey] = React.useState(false);
    React.useEffect(() => {
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
    React.useEffect(() => {
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
                    invoke('test', { hotkey: s });
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
        <WithLoading loaded={true} sx={{ width: 1, height: 1 }}>
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
        </WithLoading>


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