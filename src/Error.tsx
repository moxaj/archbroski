import React from 'react';
import { invoke, window } from '@tauri-apps/api';
import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material'
import { SentimentVeryDissatisfied } from '@mui/icons-material';

const Error = () => {
    const [errorMessage, setErrorMessage] = React.useState<string | undefined>(undefined);
    React.useEffect(() => {
        const keydownListener = (event: KeyboardEvent) => {
            event.preventDefault();
        };
        document.addEventListener('keydown', keydownListener);
        return () => {
            document.removeEventListener('keydown', keydownListener);
        };
    }, []);
    React.useEffect(() => {
        invoke<string>('get_error_message').then(setErrorMessage).catch(console.error);
    }, []);
    React.useEffect(() => {
        window.getCurrent().show();
    }, [errorMessage]);
    return (
        <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
            <AppBar position='fixed' sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar data-tauri-drag-region='true'>
                    <Typography variant='h6' component='div' color='inherit'>
                        Archbroski error
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
                <Button variant='contained' onClick={() => { invoke('exit').catch(console.error) }}>
                    Close
                </Button>
            </Toolbar>
        </Box>
    )
}

export default Error;