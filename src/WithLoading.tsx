import { Box, Fade, CircularProgress, SxProps, Theme } from '@mui/material';

export type LoadedProps = {
    loaded: boolean;
    sx?: SxProps<Theme>;
    children: React.ReactElement<any, any>;
};

const WithLoading = ({ loaded, sx, children }: LoadedProps) => {
    const sxArray = sx === undefined
        ? []
        : Array.isArray(sx) ? sx : [sx];
    return (
        <Box sx={[{ position: 'relative' }, ...sxArray]}>
            <Fade in={!loaded}>
                <Box sx={{ position: 'absolute', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <CircularProgress />
                </Box>
            </Fade>
            {loaded && (
                <Fade in={loaded} timeout={200}>
                    {children}
                </Fade>
            )}
        </Box>
    );
};

export default WithLoading;