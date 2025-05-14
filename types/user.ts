export interface UserData {
  name: string;
  email: string;
  birthday: string;
  gender: 'Male' | 'Female';
  password: string;
} 

declare module 'react-native-circular-slider' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  export interface CircularSliderProps extends ViewProps {
    value?: number;
    startAngle?: number;
    angleRange?: number;
    onUpdate?: (value: number) => void;
    segments?: number;
    strokeWidth?: number;
    radius?: number;
    gradientColorFrom?: string;
    gradientColorTo?: string;
    showClockFace?: boolean;
    clockFaceColor?: string;
    bgCircleColor?: string;
    stopIcon?: JSX.Element;
    startIcon?: JSX.Element;
    // Add any other props the library supports
  }

  export default class CircularSlider extends Component<CircularSliderProps> {}
}