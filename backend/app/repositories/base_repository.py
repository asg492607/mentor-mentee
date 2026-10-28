from typing import Optional
from app.core.exceptions import ServiceUnavailableException


class BaseRepository:
    def __init__(self, collection_name: str):
        from app.firebase.client import db
        if not db:
            raise ServiceUnavailableException("Firestore is not configured")
        self.db = db
        self.collection_name = collection_name
        self.collection_ref = db.collection(collection_name)

    @property
    def collection(self):
        return self.collection_ref

    def create(self, data: dict, doc_id: str = None) -> str:
        if doc_id:
            self.collection_ref.document(doc_id).set(data)
            return doc_id
        doc_ref = self.collection_ref.document()
        doc_ref.set(data)
        return doc_ref.id

    def get(self, doc_id: str) -> Optional[dict]:
        doc = self.collection_ref.document(doc_id).get()
        if doc.exists:
            return {"id": doc.id, **doc.to_dict()}
        return None

    def get_by_id(self, doc_id: str) -> Optional[dict]:
        return self.get(doc_id)

    def update(self, doc_id: str, data: dict) -> None:
        self.collection_ref.document(doc_id).update(data)

    def delete(self, doc_id: str) -> None:
        self.collection_ref.document(doc_id).delete()

    def get_all(self) -> list[dict]:
        return [{"id": doc.id, **doc.to_dict()} for doc in self.collection_ref.stream()]

    def query(
        self,
        filters: list[tuple] = None,
        order_by: str = None,
        limit: int = None,
        direction: str = 'ASCENDING',
    ) -> list[dict]:
        ref = self.collection_ref
        if filters:
            for field, op, value in filters:
                ref = ref.where(field, op, value)
        if order_by:
            from google.cloud.firestore_v1 import query as q
            dir_val = q.Query.ASCENDING if direction == 'ASCENDING' else q.Query.DESCENDING
            ref = ref.order_by(order_by, direction=dir_val)
        if limit:
            ref = ref.limit(limit)
        return [{"id": doc.id, **doc.to_dict()} for doc in ref.stream()]

    def query_department_scope(self, department: str) -> list[dict]:
        if not department:
            return []
        if department.startswith("id:"):
            department_id = department[3:]
            department_doc = self.db.collection("departments").document(department_id).get()
            department_data = department_doc.to_dict() or {} if department_doc.exists else {}
            department_name = str(department_data.get("name") or "")
            school_id = department_data.get("schoolId")
        elif department.startswith("legacy:"):
            scope = department[7:]
            department_name, _, school_id = scope.partition("|")
            department_id = ""
        else:
            department_name = department
            department_id = ""
            school_id = None

        records = {}
        if department_id:
            records.update({item["id"]: item for item in self.query(filters=[("departmentId", "==", department_id)])})
        if department_name:
            filters = [("department", "==", department_name), ("departmentId", "==", None)]
            if department_id or department.startswith("legacy:"):
                filters.append(("schoolId", "==", school_id or None))
            records.update({item["id"]: item for item in self.query(filters=filters)})
        return list(records.values())

    def count(self, filters: list[tuple] = None) -> int:
        return len(self.query(filters=filters))
