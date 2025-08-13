def get_user_repr(user):
    """Turn user object into dict with required properties"""
    if user.is_anonymous:
        return {'key': str(user), 'custom': {'organization': None}}
    user_data = {'email': user.email}
    user_data['key'] = user_data['email']
    if user.active_organization is not None:
        org = user.active_organization
        user_data['custom'] = {'organization': org.created_by.email if org and org.created_by else None}
    else:
        user_data['custom'] = {'organization': None}
    return user_data
