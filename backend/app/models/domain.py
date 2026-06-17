from dataclasses import dataclass

@dataclass
class UserDomain:
    uid: str
    email: str
    role: str
    name: str
    department: str
