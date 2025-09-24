"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import os
import uuid
from time import time
from django.contrib.auth.models import Group  # 新增的导入
from core.utils.common import load_func
from django import forms
from django.conf import settings
from django.contrib import auth
from django.core.files.images import get_image_dimensions
from django.shortcuts import redirect
from django.urls import reverse
from organizations.models import Organization, OrganizationMember



def hash_upload(instance, filename):
    filename = str(uuid.uuid4())[0:8] + '-' + filename
    return settings.AVATAR_PATH + '/' + filename


def check_avatar(files):
    images = list(files.items())
    if not images:
        return None

    _, avatar = list(files.items())[0]  # get first file
    w, h = get_image_dimensions(avatar)
    if not w or not h:
        raise forms.ValidationError("Can't read image, try another one")

    # validate dimensions
    max_width = max_height = 1200
    if w > max_width or h > max_height:
        raise forms.ValidationError('Please use an image that is %s x %s pixels or smaller.' % (max_width, max_height))

    valid_extensions = ['jpeg', 'jpg', 'gif', 'png']

    filename = avatar.name
    # check file extension
    ext = os.path.splitext(filename)[1].lstrip('.').lower()
    if ext not in valid_extensions:
        raise forms.ValidationError('Please upload a valid image file with extensions: JPEG, JPG, GIF, or PNG.')

    # validate content type
    main, sub = avatar.content_type.split('/')
    if not (main == 'image' and sub.lower() in valid_extensions):
        raise forms.ValidationError('Please use a JPEG, GIF or PNG image.')

    # validate file size
    max_size = 1024 * 1024
    if len(avatar) > max_size:
        raise forms.ValidationError('Avatar file size may not exceed ' + str(max_size / 1024) + ' kb')

    return avatar

def save_user_db(user_form):
    """Save user instance to DB and create专属组织"""
   # user = auth.authenticate(email=user_form['email'], password=user_form['email'],username = user_form['email'].split('@')[0])
    print(type(user_form))
    from users.models import User
    user = User.objects.create_user(email=user_form['email'],  password=user_form['email'], allow_newsletters=False)
    user.username = user.email.split('@')[0]
    print("创建用户成功",user.username)
    # user.save()
    # print(user)

    # --------------------------
    # 1. 处理用户组（保持之前的专属组逻辑）
    # --------------------------
    user.groups.clear()  # 清除默认组
    group_name = f"user_{user.id}_group"
    user_group, _ = Group.objects.get_or_create(name=group_name)
    user.groups.add(user_group)

    # --------------------------
    # 2. 为新用户创建专属组织（关键修改）
    # --------------------------
    # 组织名称：包含用户名和ID，确保唯一
    org_title = f"Organization_{user.username}_{user.id}"
    # 强制创建新组织，不检查现有组织
    org = Organization.create_organization(
        created_by=user,
        title=org_title
    )

    # --------------------------
    # 3. 将用户关联到自己的专属组织
    # --------------------------
    # 创建组织成员关系（用户是该组织的创建者/成员）
    OrganizationMember.objects.get_or_create(
        organization=org,
        user=user,
        defaults={'role': 'member'}  # 仅在新创建时设置role
    )
    # 设置用户的活跃组织为自己的专属组织
    user.active_organization = org
    # user.save(update_fields=['active_organization'])
    user.save()
    return user

def save_user(request, next_page, user_form):
    """Save user instance to DB and create专属组织"""
    user = user_form.save()
    user.username = user.email.split('@')[0]
    user.save()

    # --------------------------
    # 1. 处理用户组（保持之前的专属组逻辑）
    # --------------------------
    user.groups.clear()  # 清除默认组
    group_name = f"user_{user.id}_group"
    user_group, _ = Group.objects.get_or_create(name=group_name)
    user.groups.add(user_group)

    # --------------------------
    # 2. 为新用户创建专属组织（关键修改）
    # --------------------------
    # 组织名称：包含用户名和ID，确保唯一
    org_title = f"Organization_{user.username}_{user.id}"
    # 强制创建新组织，不检查现有组织
    org = Organization.create_organization(
        created_by=user,
        title=org_title
    )

    # --------------------------
    # 3. 将用户关联到自己的专属组织
    # --------------------------
    # 创建组织成员关系（用户是该组织的创建者/成员）
    OrganizationMember.objects.get_or_create(
        organization=org,
        user=user,
        defaults={'role': 'member'}  # 仅在新创建时设置role
    )
    # 设置用户的活跃组织为自己的专属组织
    user.active_organization = org
    user.save(update_fields=['active_organization'])

    # --------------------------
    # 4. 保留其他逻辑（日志、跳转等）
    # --------------------------
    request.advanced_json = {
        'email': user.email,
        'allow_newsletters': user.allow_newsletters,
        'update-notifications': 1,
        'new-user': 1,
        'how_find_us': user_form.cleaned_data.get('how_find_us', ''),
    }
    if user_form.cleaned_data.get('how_find_us', '') == 'Other':
        request.advanced_json['elaborate'] = user_form.cleaned_data.get('elaborate', '')

    redirect_url = next_page if next_page else reverse('projects:project-index')
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    return redirect(redirect_url)

def proceed_registration(request, user_form, organization_form, next_page):
    """Register a new user for POST user_signup"""
    # save user to db
    save_user = load_func(settings.SAVE_USER)
    response = save_user(request, next_page, user_form)

    return response


def login(request, *args, **kwargs):
    request.session['last_login'] = time()
    return auth.login(request, *args, **kwargs)
