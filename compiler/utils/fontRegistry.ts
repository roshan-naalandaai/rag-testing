/**
 * FontRegistry - Central registry for font management
 * Maps font family names to URLs and provides character width ratios for layout
 */

export interface FontConfig {
  name: string;
  url: string;
  charWidthRatio: number; // Ratio of character width to font size
  type: 'local' | 'remote';
}

/**
 * Font registry with all available fonts
 */
class FontRegistryClass {
  private fonts: Map<string, FontConfig> = new Map();

  constructor() {
    this.registerDefaultFonts();
  }

  /**
   * Register default fonts
   */
  private registerDefaultFonts(): void {
    // Default font (CaveatBrush) - remote
    this.register({
      name: 'CaveatBrush',
      url: 'https://raw.githubusercontent.com/google/fonts/refs/heads/main/ofl/caveatbrush/CaveatBrush-Regular.ttf',
      charWidthRatio: 0.6,
      type: 'remote',
    });

    // Caveat (similar to CaveatBrush, common fallback)
    this.register({
      name: 'Caveat',
      url: 'https://raw.githubusercontent.com/google/fonts/refs/heads/main/ofl/caveat/Caveat-Regular.ttf',
      charWidthRatio: 0.55,
      type: 'remote',
    });

    // Custom fonts - local files
    this.register({
      name: 'Segoe Print',
      url: './assets/fonts/segoe-print.ttf',
      charWidthRatio: 0.65, // Segoe Print is slightly wider
      type: 'local',
    });

    this.register({
      name: 'Set Fire to the Rain',
      url: './assets/fonts/set-fire-to-the-rain.ttf',
      charWidthRatio: 0.7, // Script fonts tend to be wider
      type: 'local',
    });

    this.register({
      name: 'Jeronimo Bounce',
      url: './assets/fonts/jeronimo-bounce.ttf',
      charWidthRatio: 0.55, // Playful fonts vary, estimate medium
      type: 'local',
    });

    // Additional Google Fonts (can be added as needed)
    this.register({
      name: 'Permanent Marker',
      url: 'https://raw.githubusercontent.com/google/fonts/refs/heads/main/apache/permanentmarker/PermanentMarker-Regular.ttf',
      charWidthRatio: 0.7,
      type: 'remote',
    });

    this.register({
      name: 'Patrick Hand',
      url: 'https://raw.githubusercontent.com/google/fonts/refs/heads/main/ofl/patrickhand/PatrickHand-Regular.ttf',
      charWidthRatio: 0.6,
      type: 'remote',
    });
  }

  /**
   * Register a new font
   */
  public register(config: FontConfig): void {
    this.fonts.set(config.name, config);
  }

  /**
   * Get font URL by family name
   * @throws Error if font not found
   */
  public getFontUrl(fontFamily: string): string {
    const font = this.fonts.get(fontFamily);
    if (!font) {
      throw new Error(
        `Font "${fontFamily}" not found in registry. Available fonts: ${Array.from(this.fonts.keys()).join(', ')}`
      );
    }
    return font.url;
  }

  /**
   * Get character width ratio for font family
   * @returns ratio or default 0.5 if font not found
   */
  public getCharWidthRatio(fontFamily: string): number {
    const font = this.fonts.get(fontFamily);
    return font ? font.charWidthRatio : 0.5; // Default fallback
  }

  /**
   * Check if font exists in registry
   */
  public hasFont(fontFamily: string): boolean {
    return this.fonts.has(fontFamily);
  }

  /**
   * Get all registered font names
   */
  public getAvailableFonts(): string[] {
    return Array.from(this.fonts.keys());
  }

  /**
   * Get font config
   */
  public getFontConfig(fontFamily: string): FontConfig | undefined {
    return this.fonts.get(fontFamily);
  }
}

// Export singleton instance
export const FontRegistry = new FontRegistryClass();
