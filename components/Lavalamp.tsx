import { useMemo } from 'react';
import { View, Text } from 'react-native';
import randomColor from 'randomcolor';

type LavalampProps = {
    count: number
}

export function LavaLamp({count}: LavalampProps) {
    const circles = useMemo(() => {
        const colors = randomColor({
            count: 10,
            hue: 'blue',
        });
}, [])

return (
    <View>
        <Text>Lava Lamp</Text>
    </View>
);
}