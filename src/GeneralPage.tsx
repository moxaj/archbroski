import React from 'react';
import { invoke } from '@tauri-apps/api';
import { Box, Button, Typography } from '@mui/material';
import { UserSettings } from './Settings';
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
    )
};

export default GeneralPage;