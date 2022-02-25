import { Help } from "@mui/icons-material";
import { Box, Divider, FormControlLabel, FormGroup, Icon, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { useState } from "react";

type RewardType = 'Generic'
    | 'Armour'
    | 'Weapon'
    | 'Jewelry'
    | 'Gem'
    | 'Map'
    | 'DivinationCard'
    | 'Fragment'
    | 'Essence'
    | 'Harbinger'
    | 'Unique'
    | 'Delve'
    | 'Blight'
    | 'Ritual'
    | 'Currency'
    | 'Legion'
    | 'Breach'
    | 'Labyrinth'
    | 'Scarab'
    | 'Abyss'
    | 'Heist'
    | 'Expedition'
    | 'Delirium'
    | 'Metamorph';

const SettingsPage = () => {
    const [mode, setMode] = useState('simple');
    const updateMode = (mode: string) => {
        if (mode) {
            setMode(mode);
        }
    };
    const [rewards, setRewards] = useState<{ [key: string]: number }>({
        'Generic': 1,
        'Armour': 1,
        'Weapon': 1,
        'Jewelry': 1,
        'Gem': 1,
        'Map': 1,
        'DivinationCard': 1,
        'Fragment': 1,
        'Essence': 1,
        'Harbinger': 1,
        'Unique': 1,
        'Delve': 1,
        'Blight': 1,
        'Ritual': 1,
        'Currency': 1,
        'Legion': 1,
        'Breach': 1,
        'Labyrinth': 1,
        'Scarab': 1,
        'Abyss': 1,
        'Heist': 1,
        'Expedition': 1,
        'Delirium': 1,
        'Metamorph': 1
    });
    const updateRewards = (reward: RewardType, value: number) => {
        setRewards(rewards => {
            return { ...rewards, [reward]: Math.min(10, Math.max(1, value)) };
        });
    };
    return (
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                <Box sx={{ visibility: 'hidden' }}>
                    <Help />
                </Box>
                <ToggleButtonGroup
                    sx={{ mx: 2 }}
                    color="primary"
                    value={mode}
                    exclusive
                    onChange={(_, mode) => updateMode(mode)}
                >
                    <ToggleButton value="simple">Simple</ToggleButton>
                    <ToggleButton value="smart">Smart</ToggleButton>
                </ToggleButtonGroup>
                <Tooltip title={'Smart mode is slower, but may suggest more valuable combos.'}>
                    <Help />
                </Tooltip>
            </Box>
            <Divider sx={{ m: 2 }} />
            <Typography sx={{ textAlign: 'center', mb: 4 }}>
                Relative reward values
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                {Object.keys(rewards).map(reward => (
                    <TextField key={reward} label={reward} type="number" variant="standard"
                        InputLabelProps={{
                            shrink: true,
                        }}
                        inputProps={{
                            min: 0, max: 10
                        }}
                        sx={{ width: 80, mx: 3, mb: 6 }}
                        disabled={mode === 'simple'}
                        value={rewards[reward]}
                        onChange={(event) => { updateRewards(reward as RewardType, +event.target.value) }} />
                ))}
            </Box>
        </Box>
    )
};

export default SettingsPage;