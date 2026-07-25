from fastapi import HTTPException

class LuminaException(HTTPException):
    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)

class NotFoundException(LuminaException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=404, detail=detail)

class UnauthorizedException(LuminaException):
    def __init__(self, detail: str = "Unauthorized"):
        super().__init__(status_code=401, detail=detail)

class ForbiddenException(LuminaException):
    def __init__(self, detail: str = "Forbidden"):
        super().__init__(status_code=403, detail=detail)

class BadRequestException(LuminaException):
    def __init__(self, detail: str = "Bad Request"):
        super().__init__(status_code=400, detail=detail)

class ServiceUnavailableException(LuminaException):
    def __init__(self, detail: str = "Service unavailable"):
        super().__init__(status_code=503, detail=detail)
