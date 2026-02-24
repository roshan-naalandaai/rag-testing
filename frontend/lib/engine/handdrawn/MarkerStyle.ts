import { StrokeStyle } from '../types';

export class MarkerStyle implements StrokeStyle {
  public name = 'marker';
  public baseWidth = 6;
  public noiseAmplitude = 0.8;
  public opacityBehavior: 'constant' | 'fade' | 'pressure' = 'pressure';
  public pressureVariation = 0.2;

  // Marker-specific properties
  public smoothness = 0.9; // Smoother than chalk
  public opacity = 1.0; // Fully opaque
  public saturation = 1.0; // Vibrant colors
}

