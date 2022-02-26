import { useEffect, useState } from 'react';
import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material'
import { tauri, window } from '@tauri-apps/api';
import { SentimentVeryDissatisfied } from '@mui/icons-material';

const Error = () => {
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    useEffect(() => {
        const keydownListener = (event: KeyboardEvent) => {
            event.preventDefault();
        };
        document.addEventListener('keydown', keydownListener);
        return () => {
            document.removeEventListener('keydown', keydownListener);
        };
    }, []);
    useEffect(() => {
        (async () => {
            setErrorMessage(await tauri.invoke<string>('get_error_message'));
        })();
    }, []);
    useEffect(() => {
        window.getCurrent().show();
    }, [errorMessage]);
    return (
        <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
            <AppBar position='fixed' sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar data-tauri-drag-region='true'>
                    <Typography variant='h6' component='div' color='inherit'>
                        ArchBro error
                    </Typography>
                </Toolbar>
            </AppBar>
            <Toolbar />
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 1 }}>
                <SentimentVeryDissatisfied sx={{ width: 80, height: 80, mb: 2 }} />
                <Typography variant='body1' color='inherit'>
                    {errorMessage === 'failed_to_load_user_settings' && (
                        <span>Failed to access your user settings in your home directory!</span>
                    )}
                    {errorMessage === 'failed_to_load_cache' && (
                        <span>Failed to access the cache in your home directory!</span>
                    )}
                </Typography>
            </Box>
            <Toolbar sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Button variant='contained' onClick={() => { tauri.invoke('exit') }}>
                    Close
                </Button>
            </Toolbar>
        </Box>
    )
}

export default Error;