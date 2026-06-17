from app.repositories.base_repository import BaseRepository

class DepartmentRepository(BaseRepository):
    def __init__(self):
        super().__init__('departments')

    def get_by_code(self, code: str):
        query = self.collection.where('code', '==', code).limit(1)
        docs = list(query.stream())
        if docs:
            return docs[0].to_dict() | {'id': docs[0].id}
        return None
