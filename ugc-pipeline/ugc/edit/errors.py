"""Errors raised by the edit stage. Each message says what to do next."""


class EditError(RuntimeError):
    pass


class TimelineError(EditError):
    pass


class LabelError(EditError):
    """The AI label could not be composited onto every frame. This is a legal requirement."""


class FailedSelectError(EditError):
    pass


class OverlayError(EditError):
    pass
