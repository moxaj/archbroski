import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { UserSettingsContext } from './Settings';
import WithLoading from './WithLoading';

const GeneralSettings = () => {
    const [userSettings, setUserSettings] = React.useContext(UserSettingsContext)!;
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
                        ...userSettings,
                        hotkey
                    }));
                }
            }
        };
        document.addEventListener('keydown', keydownListener);
        return () => {
            document.removeEventListener('keydown', keydownListener);
        };
    }, [recordingHotkey, setUserSettings]);
    return (
        <WithLoading sx={{ width: 1, height: 1 }} loadSuccessful={(
            <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant='h6' sx={{ my: 1 }}>
                            Hotkey
                        </Typography>
                        <Button variant='outlined' sx={{ width: 200 }} onClick={() => { setRecordingHotkey(true) }}>
                            {recordingHotkey ? 'Press a key...' : userSettings.hotkey}
                        </Button>
                    </Box>
                </Box>
            </Box>
        )} />
    )
};

export default GeneralSettings;