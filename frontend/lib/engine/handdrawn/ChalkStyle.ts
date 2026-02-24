import { StrokeStyle } from '../types';

export class ChalkStyle implements StrokeStyle {
  public name = 'chalk';
  public baseWidth = 4;
  public noiseAmplitude = 1.5;
  public opacityBehavior: 'constant' | 'fade' | 'pressure' = 'constant';
  public pressureVariation = 0.3;

  // Chalk-specific properties
  public dustiness = 0.8; // How much texture/grain
  public opacity = 0.9; // Slightly transparent like real chalk
}

