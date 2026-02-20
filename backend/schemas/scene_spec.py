from __future__ import annotations

from typing import List, Union, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from pydantic.types import StrictStr, StrictInt, StrictFloat, StrictBool


# =========================
# ENUM DEFINITIONS
# =========================

PositionType = Literal["center", "left", "right", "top", "bottom"]

RegionType = Literal[
    "main-content",
    "top-banner",
    "bottom-banner",
    "left-third",
    "right-third",
    "center-third",
    "left-half",
    "right-half",
    "top-third",
    "bottom-third",
]

SizeType = Literal["small", "medium", "large"]

AnimationType = Literal["draw", "fade", "none"]

ShapeType = Literal["rectangle", "circle", "line"]


# =========================
# CORE META MODELS
# =========================

class Resolution(BaseModel):
    model_config = ConfigDict(extra="forbid")

    width: StrictInt = Field(..., gt=0)
    height: StrictInt = Field(..., gt=0)


class Meta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: StrictStr
    version: StrictStr
    resolution: Resolution
    fps: StrictInt = Field(..., gt=0)
    backgroundColor: StrictStr


# =========================
# ASSETS
# =========================

class SvgAsset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: StrictStr
    url: StrictStr
    width: StrictInt = Field(..., gt=0)
    height: StrictInt = Field(..., gt=0)


class AudioAsset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: StrictStr
    url: StrictStr


class Assets(BaseModel):
    model_config = ConfigDict(extra="forbid")

    svgs: List[SvgAsset]
    audio: List[AudioAsset]
    images: List[StrictStr] = Field(default_factory=list)


# =========================
# LAYOUT (NO COORDINATES)
# =========================

class Offset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: StrictInt
    y: StrictInt


class Layout(BaseModel):
    model_config = ConfigDict(extra="forbid")

    position: PositionType
    region: RegionType
    size: Optional[SizeType] = None
    offset: Optional[Offset] = None


# =========================
# ELEMENTS
# =========================

class BaseElement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: StrictStr
    startTime: StrictFloat = Field(..., ge=0)
    duration: StrictFloat = Field(..., gt=0)
    layout: Layout


class TextElement(BaseElement):
    type: Literal["text"]

    text: StrictStr
    color: StrictStr
    fontSize: StrictInt = Field(..., gt=0)
    fontFamily: StrictStr
    animationType: AnimationType


class SvgElement(BaseElement):
    type: Literal["svg"]

    assetId: StrictStr


class ShapeElement(BaseElement):
    type: Literal["shape"]

    shape: ShapeType
    color: StrictStr
    fill: StrictBool


Element = Union[TextElement, SvgElement, ShapeElement]


# =========================
# SCENE
# =========================

class AudioRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assetId: StrictStr
    volume: StrictFloat = Field(..., ge=0.0, le=1.0)


class Scene(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: StrictStr
    name: StrictStr
    startTime: StrictFloat = Field(..., ge=0)
    duration: StrictFloat = Field(..., gt=0)
    background: StrictStr
    audio: AudioRef
    elements: List[Element]

    @model_validator(mode="after")
    def validate_element_timings(self):
        """
        Ensure no element exceeds scene duration.
        """
        for element in self.elements:
            if element.startTime + element.duration > self.duration:
                raise ValueError(
                    f"Element exceeds scene duration in scene '{self.id}'."
                )
        return self


# =========================
# TOP LEVEL SCENESPEC
# =========================

class SceneSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    meta: Meta
    assets: Assets
    scenes: List[Scene]

    @model_validator(mode="after")
    def validate_scene_timeline(self):
        """
        Ensure scenes do not overlap in timeline.
        """
        sorted_scenes = sorted(self.scenes, key=lambda s: s.startTime)

        for i in range(len(sorted_scenes) - 1):
            current = sorted_scenes[i]
            next_scene = sorted_scenes[i + 1]

            if current.startTime + current.duration > next_scene.startTime:
                raise ValueError(
                    f"Scenes '{current.id}' and '{next_scene.id}' overlap in timeline."
                )

        return self
