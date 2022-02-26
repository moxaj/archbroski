import { Dispatch, SetStateAction } from 'react';
import { UserSettings } from './Settings';

type CombosPageProps = {
    userSettings: UserSettings;
    setUserSettings: Dispatch<SetStateAction<UserSettings | undefined>>;
}

const CombosPage = ({ userSettings, setUserSettings }: CombosPageProps) => {
    return (
        <div>
            CombosPage
        </div>
    )
};

export default CombosPage;