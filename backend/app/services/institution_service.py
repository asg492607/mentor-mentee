from app.core.exceptions import BadRequestException
from app.repositories.base_repository import BaseRepository
from app.repositories.department_repository import DepartmentRepository


def resolve_academic_placement(data: dict) -> dict:
    """Resolve and validate school, department and classroom references for a profile."""
    department_repo = DepartmentRepository()
    class_repo = BaseRepository("classes")
    all_departments = department_repo.get_all()
    schools = [item for item in all_departments if str(item.get("type", "")).upper() in {"SCHOOL", "COLLEGE"}]
    department_id = str(data.get("departmentId") or "").strip()
    department_name = str(data.get("department") or "").strip()
    school_id = str(data.get("schoolId") or "").strip()
    school_name = str(data.get("schoolName") or "").strip()
    department = department_repo.get_by_id(department_id) if department_id else None

    if department_id and not department:
        raise BadRequestException("Selected department was not found")
    if department and str(department.get("type", "")).upper() in {"SCHOOL", "COLLEGE"}:
        raise BadRequestException("Select a department, not a school, for this user")

    if not department and department_name:
        matches = [
            item for item in all_departments
            if str(item.get("name", "")).strip().casefold() == department_name.casefold()
            and str(item.get("type", "")).upper() not in {"SCHOOL", "COLLEGE"}
        ]
        if school_id:
            matches = [item for item in matches if item.get("schoolId") == school_id]
        if school_name:
            matches = [item for item in matches if str(
                item.get("schoolName") or next((school.get("name") for school in schools if school.get("id") == item.get("schoolId")), "")
            ).strip().casefold() == school_name.casefold()]
        if len(matches) > 1:
            raise BadRequestException("Department name matches multiple schools; provide departmentId or schoolId")
        if matches:
            department = matches[0]

    if department:
        linked_school_id = department.get("schoolId")
        linked_school_name = department.get("schoolName") or next(
            (school.get("name") for school in schools if school.get("id") == linked_school_id), ""
        )
        if schools and not linked_school_id:
            raise BadRequestException("Link this department to a school before creating academic profiles")
        if school_id and school_id != linked_school_id:
            raise BadRequestException("Selected department does not belong to the selected school")
        if school_name and school_name.casefold() != linked_school_name.strip().casefold():
            raise BadRequestException("Selected department does not belong to the selected school")
        department_name = department.get("name") or department_name
        department_id = department.get("id")
        school_id = linked_school_id or school_id
        school_name = linked_school_name or school_name
        if school_id and not school_name:
            school = department_repo.get_by_id(school_id)
            school_name = (school or {}).get("name") or ""
    elif all_departments and department_name:
        raise BadRequestException("Select a department configured by the university admin")

    class_name = str(data.get("class") or "").strip()
    class_id = str(data.get("classId") or "").strip()
    class_record = class_repo.get_by_id(class_id) if class_id else None
    if class_id and not class_record:
        raise BadRequestException("Selected classroom was not found")
    if class_record:
        if department_id and class_record.get("departmentId") and class_record.get("departmentId") != department_id:
            raise BadRequestException("Selected classroom does not belong to the selected department")
        if department_name and not class_record.get("departmentId") and str(class_record.get("department") or "").strip().casefold() != department_name.casefold():
            raise BadRequestException("Selected classroom does not belong to the selected department")
        if school_id and class_record.get("schoolId") and school_id != class_record.get("schoolId"):
            raise BadRequestException("Selected classroom does not belong to the selected school")
        if class_name and class_record.get("className") != class_name:
            raise BadRequestException("Classroom name does not match the selected classroom")
        class_name = class_record.get("className") or class_name
    elif class_name and department_id:
        class_matches = class_repo.query(filters=[("departmentId", "==", department_id), ("className", "==", class_name)])
        if class_matches:
            class_record = class_matches[0]
            class_id = class_record.get("id")

    return {
        "schoolId": school_id or None,
        "schoolName": school_name or None,
        "departmentId": department_id or None,
        "department": department_name or None,
        "classId": (class_record or {}).get("id") or class_id or None,
        "class": class_name or None,
    }


def same_department(student: dict, mentor: dict, records: list[dict] = None) -> bool:
    records = records if records is not None else DepartmentRepository().get_all()
    schools = [item for item in records if str(item.get("type", "")).upper() in {"SCHOOL", "COLLEGE"}]
    departments = [item for item in records if str(item.get("type", "")).upper() not in {"SCHOOL", "COLLEGE"}]

    def resolve_key(profile: dict):
        department_id = profile.get("departmentId")
        if department_id:
            return department_id if any(item.get("id") == department_id for item in departments) else None
        name = str(profile.get("department") or "").strip().casefold()
        if not name:
            return None
        matches = [item for item in departments if str(item.get("name") or "").strip().casefold() == name]
        if profile.get("schoolId"):
            matches = [item for item in matches if item.get("schoolId") == profile.get("schoolId")]
        school_name = str(profile.get("schoolName") or "").strip().casefold()
        if school_name:
            matches = [item for item in matches if str(
                item.get("schoolName") or next((school.get("name") for school in schools if school.get("id") == item.get("schoolId")), "")
            ).strip().casefold() == school_name]
        if len(matches) == 1:
            return matches[0].get("id")
        if records:
            return None
        return f"legacy:{name}|{profile.get('schoolId') or school_name}"

    student_key = resolve_key(student)
    mentor_key = resolve_key(mentor)
    return bool(student_key and mentor_key and student_key == mentor_key)
