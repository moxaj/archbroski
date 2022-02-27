import { Box } from '@mui/system';
import { Link, Typography } from '@mui/material';
import WithLoading from './WithLoading';

const AboutPage = () => {
    return (
        <WithLoading loaded={true} sx={{ width: 1, height: 1 }}>
            <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant='h6'>
                    Source code, bug reports and feature requests, discussion
                </Typography>
                <Typography variant='body1' sx={{ mb: 2, px: 2 }}>
                    <Link target={'_blank'} href='https://github.com/moxaj/archbroski'>GitHub</Link>
                </Typography>
                <Typography variant='h6'>
                    Built with
                </Typography>
                <Typography variant='body1' sx={{ px: 2 }}>
                    <span>Rust + </span><Link target={'_blank'} href='https://github.com/tauri-apps/tauri'>Tauri</Link>
                    <span> + </span><Link target={'_blank'} href='https://github.com/twistedfall/opencv-rust'>OpenCV</Link><br />
                    <span>React + Material UI</span><br />
                </Typography>
                <Typography variant='body2' sx={{ px: 2, fontStyle: 'italic' }}>
                    + a bunch of other libraries, see <Link target={'_blank'} href='https://github.com/moxaj/archbroski/blob/main/package.json'>these</Link>
                    &nbsp;<Link target={'_blank'} href='https://github.com/moxaj/archbroski/blob/main/src-tauri/Cargo.toml'>files</Link>
                </Typography>
            </Box>
        </WithLoading>
    )
};

export default AboutPage;