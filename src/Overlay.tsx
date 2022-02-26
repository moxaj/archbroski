import { Check, Error, Help } from '@mui/icons-material';
import { CircularProgress, Fade, Grow } from '@mui/material';
import { Box } from '@mui/system';
import { invoke, tauri, window } from '@tauri-apps/api';
import { UnlistenFn } from '@tauri-apps/api/event';
import { useEffect, useRef, useState } from 'react';

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
    const [state, setState] = useState<State>({ type: 'Hidden' });
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        const unlisten = window.getCurrent().listen('tauri://blur', () => {
            setState(state_ => {
                return state_.type === 'Hidden' ? state_ : { type: 'Hidden' };
            });
        });
        return () => {
            unlisten.then(f => f());
        };
    }, []);
    useEffect(() => {
        const keydownListener = () => {
            setState({ type: 'Hidden' });
        };
        document.addEventListener('keydown', keydownListener);
        return () => {
            document.removeEventListener('keydown', keydownListener);
        };
    }, []);
    useEffect(() => {
        const mousedownListener = () => {
            setState({ type: 'Hidden' });
        };
        document.addEventListener('mousedown', mousedownListener);
        return () => {
            document.removeEventListener('mousedown', mousedownListener);
        };
    }, []);
    useEffect(() => {
        const unlisten = window.getCurrent().listen<State>('update', event => {
            setState(event.payload);
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);
    useEffect(() => {
        (async () => {
            if (state.type === 'Hidden') {
                setTimeout(async () => {
                    await invoke('hide_overlay_window');
                }, 50);
                return;
            }

            let currentWindow = window.getCurrent();
            let [monitorWidth, monitorHeight] = await tauri.invoke<[number, number]>('get_monitor_size');
            currentWindow.setSize(new window.PhysicalSize(monitorWidth, monitorHeight));

            const canvas = canvasRef.current!;
            canvas.width = monitorWidth;
            canvas.height = monitorHeight;
            canvas.style.width = `${monitorWidth}px`;
            canvas.style.height = `${monitorHeight}px`;

            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (state.type === 'Computed') {
                const { stashArea: stash_area, suggestedCellArea: suggested_cell_area } = state;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
                ctx.fillRect(stash_area.x, stash_area.y, stash_area.width, stash_area.height);
                ctx.clearRect(suggested_cell_area.x, suggested_cell_area.y, suggested_cell_area.width, suggested_cell_area.height);
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