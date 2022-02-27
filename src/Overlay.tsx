import React from 'react';
import { window, invoke } from '@tauri-apps/api';
import { Box } from '@mui/system';
import { CircularProgress, Fade, Grow } from '@mui/material';
import { Check, Error, Help } from '@mui/icons-material';

type Rectangle = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type State = {
    type: 'Hidden';
} | {
    type: 'Computing';
} | {
    type: 'Computed';
    stashArea: Rectangle;
    suggestedCellArea: Rectangle;
} | {
    type: 'DetectionError';
} | {
    type: 'LogicError';
};

const Overlay = () => {
    const [state, setState] = React.useState<State>({ type: 'Hidden' });
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    React.useEffect(() => {
        const unlisten = window.getCurrent().listen('tauri://blur', () => {
            setState(state_ => {
                return state_.type === 'Hidden' ? state_ : { type: 'Hidden' };
            });
        });
        return () => {
            unlisten.then(f => f());
        };
    }, []);
    React.useEffect(() => {
        const keydownListener = () => {
            setState({ type: 'Hidden' });
        };
        document.addEventListener('keydown', keydownListener);
        return () => {
            document.removeEventListener('keydown', keydownListener);
        };
    }, []);
    React.useEffect(() => {
        const mousedownListener = () => {
            setState({ type: 'Hidden' });
        };
        document.addEventListener('mousedown', mousedownListener);
        return () => {
            document.removeEventListener('mousedown', mousedownListener);
        };
    }, []);
    React.useEffect(() => {
        const unlisten = window.getCurrent().listen<State>('update', event => {
            setState(event.payload);
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);
    React.useEffect(() => {
        (async () => {
            if (state.type === 'Hidden') {
                setTimeout(async () => {
                    await invoke('hide_overlay_window');
                }, 50);
                return;
            }

            let currentWindow = window.getCurrent();
            let [monitorWidth, monitorHeight, scaleFactor] = await invoke<[number, number, number]>('get_monitor_size');
            await currentWindow.setSize(new window.PhysicalSize(monitorWidth, monitorHeight));

            const canvas = canvasRef.current!;
            canvas.width = monitorWidth;
            canvas.height = monitorHeight;
            canvas.style.width = `${monitorWidth}px`;
            canvas.style.height = `${monitorHeight}px`;

            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (state.type === 'Computed') {
                const { stashArea, suggestedCellArea } = state;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
                ctx.fillRect(
                    stashArea.x / scaleFactor,
                    stashArea.y / scaleFactor,
                    stashArea.width / scaleFactor,
                    stashArea.height / scaleFactor);
                ctx.clearRect(
                    suggestedCellArea.x / scaleFactor,
                    suggestedCellArea.y / scaleFactor,
                    suggestedCellArea.width / scaleFactor,
                    suggestedCellArea.height / scaleFactor);
            }

            setTimeout(async () => {
                await currentWindow.show();
                await currentWindow.setFocus();
            }, 50);
        })().catch(console.error);
    }, [state]);
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Box sx={{
                position: 'fixed',
                left: '50%',
                bottom: 100,
                transform: 'translate(-50%, -50%)'
            }}>
                <Fade in={state.type === 'Computing'} timeout={1500} style={{ zIndex: 1 }}>
                    {
                        <Box sx={{
                            p: 0.5,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            borderRadius: '50%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <CircularProgress />
                        </Box>
                    }
                </Fade>
            </Box>
            <Box sx={{
                position: 'fixed',
                left: '50%',
                bottom: 100,
                transform: 'translate(-50%, -50%)'
            }}>
                <Grow in={state.type === 'Computed'} timeout={500} style={{ zIndex: 2 }}>
                    {
                        <Box sx={{
                            p: 0.5,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            borderRadius: '50%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <Check style={{ color: 'green', fontSize: '40px' }} />
                        </Box>
                    }
                </Grow>
            </Box>
            <Box sx={{
                position: 'fixed',
                left: '50%',
                bottom: 100,
                transform: 'translate(-50%, -50%)'
            }}>
                <Grow in={state.type === 'DetectionError'} timeout={500} style={{ zIndex: 2 }}>
                    {
                        <Box sx={{
                            p: 0.5,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            borderRadius: '50%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <Error style={{ color: 'red', fontSize: '40px' }} />
                        </Box>
                    }
                </Grow>
            </Box>
            <Box sx={{
                position: 'fixed',
                left: '50%',
                bottom: 100,
                transform: 'translate(-50%, -50%)'
            }}>
                <Grow in={state.type === 'LogicError'} timeout={500} style={{ zIndex: 2 }}>
                    {
                        <Box sx={{
                            p: 0.5,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            borderRadius: '50%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <Help style={{ color: 'red', fontSize: '40px' }} />
                        </Box>
                    }
                </Grow>
            </Box>
            <canvas ref={canvasRef} />
        </div >
    )
};

export default Overlay;