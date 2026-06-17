from app.repositories.base_repository import BaseRepository


class StudentRepository(BaseRepository):
    def __init__(self):
        super().__init__('students')

    def get_by_mentor(self, mentor_id: str) -> list[dict]:
        return self.query(filters=[('mentorId', '==', mentor_id)])

    def get_by_department(self, dept: str) -> list[dict]:
        return self.query(filters=[('department', '==', dept)])

    def get_high_risk(self) -> list[dict]:
        return self.query(filters=[('riskLevel', '==', 'HIGH')])

    def get_by_department_and_year(self, dept: str, year: int) -> list[dict]:
        return self.query(filters=[('department', '==', dept), ('year', '==', year)])

    def get_unassigned(self, department: str = None) -> list[dict]:
        filters = [('mentorId', '==', None)]
        if department:
            filters.append(('department', '==', department))
        return self.query(filters=filters)
