import React from 'react';
import { invoke } from '@tauri-apps/api';
import { Box, Button, Typography } from '@mui/material';
import { UserSettings } from './Settings';
import WithLoading from './WithLoading';

type GeneralSettingsProps = {
    userSettings: UserSettings;
    setUserSettings: React.Dispatch<React.SetStateAction<UserSettings | undefined>>;
}

const GeneralSettings = ({ userSettings, setUserSettings }: GeneralSettingsProps) => {
    const [recordingHotkey, setRecordingHotkey] = React.useState(false);
    React.useEffect(() => {
        const keydownListener = (event: KeyboardEvent) => {
            event.preventDefault();
            if (recordingHotkey) {
                if (event.key === 'Escape') {
                    setRecordingHotkey(false);
                } else {
                    let hotkey = '';
                    if (event.ctrlKey) {
                        hotkey += 'ctrl + ';
                    }

                    if (event.altKey) {
                        hotkey += 'alt + ';
                    }

                    if (event.shiftKey) {
                        hotkey += 'shift + '
                    }

                    if (/Key./.test(event.code)) {
                        hotkey += event.code.substring(3);
                    } else if (/Digit[0-9]/.test(event.code)) {
                        hotkey += event.code.substring(5);
                    } else if (/F[0-9]/.test(event.code)) {
                        hotkey += event.code;
                    } else {
                        return;
                    }

                    setRecordingHotkey(false);
                    setUserSettings(userSettings => ({
                        ...userSettings!,
                        hotkey
                    }));
                }
            }
        };
        document.addEventListener('keydown', keydownListener);
        return () => {
            document.removeEventListener('keydown', keydownListener);
        };
    }, [recordingHotkey]);
    return (
        <WithLoading loaded={true} sx={{ width: 1, height: 1 }}>
            <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography sx={{ my: 1 }}>
                            Hotkey
                        </Typography>
                        <Button variant='outlined' sx={{ width: 200 }} onClick={() => { setRecordingHotkey(true) }}>
                            {recordingHotkey ? 'Press a key...' : userSettings.hotkey}
                        </Button>
                    </Box>
                </Box>
            </Box>
        </WithLoading>
    )
};

export default GeneralSettings;