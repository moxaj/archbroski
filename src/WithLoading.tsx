import React from 'react';
import { Box, Fade, CircularProgress, SxProps, Theme } from '@mui/material';

type State = 'loading' | 'loadSuccessful' | 'loadFailed';

export type WithLoadingProps = {
    sx?: SxProps<Theme>;
    promise?: Promise<any>;
    loadSuccessful: React.ReactElement<any, any>;
    loadFailed?: React.ReactElement<any, any>;
};

const WithLoading = ({ sx, promise, loadSuccessful, loadFailed }: WithLoadingProps) => {
    const [state, setState] = React.useState<State>('loading');
    React.useEffect(() => {
        if (promise === undefined) {
            setState('loadSuccessful');
        } else {
            promise
                .then(() => {
                    setState('loadSuccessful');
                })
                .catch(() => {
                    setState('loadFailed');
                });
        }
    }, [promise]);
    const sxArray = sx === undefined
        ? []
        : Array.isArray(sx) ? sx : [sx];
    return (
        <Box sx={[{ position: 'relative' }, ...sxArray]}>
            {state === 'loading' && (
                <Fade in={true}>
                    <Box sx={{ position: 'absolute', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <CircularProgress />
                    </Box>
                </Fade>
            )}
            {state === 'loadSuccessful' && (
                <Fade in={true}>
                    {loadSuccessful}
                </Fade>
            )}
            {state === 'loadFailed' && (
                <Fade in={true}>
                    {loadFailed ?? (<div></div>)}
                </Fade>
            )}
        </Box>
    );
};

export default WithLoading;