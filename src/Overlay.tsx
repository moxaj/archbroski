import { CircularProgress, Fade } from '@mui/material';
import { Box } from '@mui/system';
import { invoke, tauri, window } from '@tauri-apps/api';
import { UnlistenFn } from '@tauri-apps/api/event';
import { useEffect, useRef, useState } from 'react';

type Rectangle = {
    x: number;
    y: number;
    width: number;
    height: number;
}

type State = {
    type: 'Hidden';
} | {
    type: 'Computing';
} | {
    type: 'Computed';
    stash_area: Rectangle;
    suggested_cell_area: Rectangle;
}

const Overlay = () => {
    const [state, setState] = useState<State>({ type: 'Hidden' });
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        let unlisten: UnlistenFn;
        (async () => {
            unlisten = await window.getCurrent().listen('tauri://blur', () => {
                setState(state_ => {
                    return state_.type === 'Hidden' ? state_ : { type: 'Hidden' };
                });
            });
        })();
        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, []);
    useEffect(() => {
        const keydownListener = (event: KeyboardEvent) => {
            setState({ type: 'Hidden' });
        };
        document.addEventListener('keydown', keydownListener);
        return () => {
            document.removeEventListener('keydown', keydownListener);
        };
    }, []);
    useEffect(() => {
        const mousedownListener = () => {
            // setState({ type: 'Hidden' });
        };
        document.addEventListener('mousedown', mousedownListener);
        return () => {
            document.removeEventListener('mousedown', mousedownListener);
        };
    }, []);
    useEffect(() => {
        let unlisten: UnlistenFn;
        (async () => {
            unlisten = await window.getCurrent().listen<State>('update', event => {
                setState(event.payload);
            });
        })();
        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, []);
    useEffect(() => {
        (async () => {
            if (state.type === 'Hidden') {
                setTimeout(async () => {
                    await invoke('hide_overlay_window');
                }, 50);
            } else {
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
                    const { stash_area, suggested_cell_area } = state;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
                    ctx.fillRect(stash_area.x, stash_area.y, stash_area.width, stash_area.height);
                    ctx.clearRect(suggested_cell_area.x, suggested_cell_area.y, suggested_cell_area.width, suggested_cell_area.height);
                }

                setTimeout(async () => {
                    await currentWindow.show();
                    await currentWindow.setFocus();
                }, 50);
            }
        })();
    }, [state]);
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Box sx={{
                position: 'fixed',
                left: '50%',
                bottom: 100,
                transform: 'translateX(-50%)'
            }}>
                <Fade in={state.type === 'Computing'} timeout={1000}>
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
            <canvas ref={canvasRef} />
        </div >
    )
};

export default Overlay;