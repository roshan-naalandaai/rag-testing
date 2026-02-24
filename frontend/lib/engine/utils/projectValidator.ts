/**
 * Project Validator - Validates project JSON against schema
 */

export class ProjectValidator {
  /**
   * Validate a project object
   * In a real implementation, this would use Ajv or similar
   */
  static validate(project: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required top-level fields
    if (!project.meta) {
      errors.push('Missing required field: meta');
    }

    if (!project.scenes) {
      errors.push('Missing required field: scenes');
    }

    // Validate meta
    if (project.meta) {
      const requiredMetaFields = ['title', 'version', 'resolution', 'fps', 'duration'];
      for (const field of requiredMetaFields) {
        if (!(field in project.meta)) {
          errors.push(`Missing required meta field: ${field}`);
        }
      }

      if (project.meta.resolution) {
        if (!project.meta.resolution.width || !project.meta.resolution.height) {
          errors.push('Resolution must have width and height');
        }
      }

      if (project.meta.fps && (project.meta.fps < 1 || project.meta.fps > 120)) {
        errors.push('FPS must be between 1 and 120');
      }

      if (project.meta.duration && project.meta.duration < 0) {
        errors.push('Duration must be non-negative');
      }
    }

    // Validate scenes
    if (project.scenes && Array.isArray(project.scenes)) {
      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        const scenePrefix = `Scene ${i} (${scene.id || 'unknown'})`;

        const requiredSceneFields = ['id', 'name', 'startTime', 'duration', 'actions'];
        for (const field of requiredSceneFields) {
          if (!(field in scene)) {
            errors.push(`${scenePrefix}: Missing required field: ${field}`);
          }
        }

        if (scene.actions && Array.isArray(scene.actions)) {
          for (let j = 0; j < scene.actions.length; j++) {
            const action = scene.actions[j];
            const actionPrefix = `${scenePrefix}, Action ${j} (${action.id || 'unknown'})`;

            if (!action.type) {
              errors.push(`${actionPrefix}: Missing required field: type`);
              continue;
            }

            // Validate based on type
            this.validateAction(action, actionPrefix, errors);
          }
        }
      }
    } else if (project.scenes) {
      errors.push('Scenes must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static validateAction(action: any, prefix: string, errors: string[]): void {
    const commonFields = ['id', 'startTime'];
    
    switch (action.type) {
      case 'stroke':
        const strokeFields = [...commonFields, 'path', 'style', 'color', 'width', 'duration'];
        this.checkFields(action, strokeFields, prefix, errors);
        
        if (action.path && !Array.isArray(action.path)) {
          errors.push(`${prefix}: path must be an array`);
        }
        
        if (action.style && !['chalk', 'marker'].includes(action.style)) {
          errors.push(`${prefix}: style must be 'chalk' or 'marker'`);
        }
        break;

      case 'shape':
        const shapeFields = [...commonFields, 'shape', 'x', 'y', 'color', 'fill', 'duration'];
        this.checkFields(action, shapeFields, prefix, errors);
        
        if (action.shape && !['circle', 'rectangle', 'ellipse', 'polygon'].includes(action.shape)) {
          errors.push(`${prefix}: Invalid shape type`);
        }
        break;

      case 'text':
        const textFields = [...commonFields, 'text', 'x', 'y', 'fontSize', 'color', 'duration'];
        this.checkFields(action, textFields, prefix, errors);
        break;

      case 'image':
        const imageFields = [...commonFields, 'assetId', 'x', 'y', 'duration'];
        this.checkFields(action, imageFields, prefix, errors);
        break;

      case 'video':
        const videoFields = [...commonFields, 'assetId', 'x', 'y', 'duration'];
        this.checkFields(action, videoFields, prefix, errors);
        break;

      case 'audio':
        const audioFields = [...commonFields, 'assetId'];
        this.checkFields(action, audioFields, prefix, errors);
        break;

      default:
        errors.push(`${prefix}: Unknown action type: ${action.type}`);
    }
  }

  private static checkFields(obj: any, fields: string[], prefix: string, errors: string[]): void {
    for (const field of fields) {
      if (!(field in obj)) {
        errors.push(`${prefix}: Missing required field: ${field}`);
      }
    }
  }

  /**
   * Get recommended fixes for common errors
   */
  static getSuggestions(project: any): string[] {
    const suggestions: string[] = [];

    // Check for reasonable values
    if (project.meta) {
      if (project.meta.fps && project.meta.fps > 60) {
        suggestions.push('Consider using 30 or 60 FPS for better compatibility');
      }

      if (project.meta.resolution) {
        const pixels = project.meta.resolution.width * project.meta.resolution.height;
        if (pixels > 1920 * 1080) {
          suggestions.push('Resolution higher than 1080p may impact performance');
        }
      }
    }

    // Check for overlapping actions
    if (project.scenes) {
      for (const scene of project.scenes) {
        if (scene.actions && scene.actions.length > 100) {
          suggestions.push(`Scene ${scene.id}: Large number of actions may impact performance`);
        }
      }
    }

    return suggestions;
  }

  /**
   * Quick validation that throws on error
   */
  static validateOrThrow(project: any): void {
    const result = this.validate(project);
    
    if (!result.valid) {
      const errorMessage = 'Project validation failed:\n' + result.errors.join('\n');
      throw new Error(errorMessage);
    }
  }
}

