class BaseRepository:
    _mock_db = {}
    
    def __init__(self, collection_name: str):
        from app.firebase.client import db
        self.db = db
        self.collection_name = collection_name
        if db:
            self.collection_ref = db.collection(collection_name)
        else:
            self.collection_ref = None
            if collection_name not in BaseRepository._mock_db:
                BaseRepository._mock_db[collection_name] = {}
    
    def create(self, data: dict, doc_id: str = None) -> str:
        if self.collection_ref:
            if doc_id:
                self.collection_ref.document(doc_id).set(data)
                return doc_id
            doc_ref = self.collection_ref.document()
            doc_ref.set(data)
            return doc_ref.id
        else:
            import uuid
            new_id = doc_id or str(uuid.uuid4())
            BaseRepository._mock_db[self.collection_name][new_id] = {**data, "id": new_id}
            return new_id
    
    def get(self, doc_id: str) -> dict | None:
        if self.collection_ref:
            doc = self.collection_ref.document(doc_id).get()
            if doc.exists:
                return {"id": doc.id, **doc.to_dict()}
            return None
        else:
            return BaseRepository._mock_db[self.collection_name].get(doc_id)
    
    def update(self, doc_id: str, data: dict) -> None:
        if self.collection_ref:
            self.collection_ref.document(doc_id).update(data)
        else:
            if doc_id in BaseRepository._mock_db[self.collection_name]:
                BaseRepository._mock_db[self.collection_name][doc_id].update(data)
    
    def delete(self, doc_id: str) -> None:
        if self.collection_ref:
            self.collection_ref.document(doc_id).delete()
        else:
            BaseRepository._mock_db[self.collection_name].pop(doc_id, None)
    
    def query(self, filters: list[tuple] = None, order_by: str = None, limit: int = None, direction: str = 'ASCENDING') -> list[dict]:
        if self.collection_ref:
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
        else:
            results = list(BaseRepository._mock_db[self.collection_name].values())
            if filters:
                for field, op, value in filters:
                    if op == '==' or op == 'equal':
                        results = [r for r in results if r.get(field) == value]
                    elif op == '!=':
                        results = [r for r in results if r.get(field) != value]
                    elif op == '>':
                        results = [r for r in results if r.get(field) is not None and r.get(field) > value]
                    elif op == '<':
                        results = [r for r in results if r.get(field) is not None and r.get(field) < value]
                    elif op == '>=':
                        results = [r for r in results if r.get(field) is not None and r.get(field) >= value]
                    elif op == '<=':
                        results = [r for r in results if r.get(field) is not None and r.get(field) <= value]
                    elif op == 'in':
                        results = [r for r in results if r.get(field) in value]
            if order_by:
                reverse = (direction != 'ASCENDING')
                results = sorted(results, key=lambda x: str(x.get(order_by) or ""), reverse=reverse)
            if limit:
                results = results[:limit]
            return results
    
    def count(self, filters: list[tuple] = None) -> int:
        return len(self.query(filters=filters))
