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
      // Add any other props specific to the library
    }
  
    export default class CircularSlider extends Component<CircularSliderProps> {}
  }