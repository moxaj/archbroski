import { Link, Typography } from '@mui/material';
import { Box } from '@mui/system';

const AboutPage = () => {
    return (
        <Box sx={{ width: 1, height: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography variant='h6'>
                Source code, bug reports and feature requests
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
                + a bunch of other libraries, see package.json and Cargo.toml
            </Typography>
        </Box>
    )
};

export default AboutPage;